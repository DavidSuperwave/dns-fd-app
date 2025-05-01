import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js'; // Import SupabaseClient
import { v4 as uuidv4 } from 'uuid';

// Define the Cloudflare domain interface
interface CloudflareDomain {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  type?: string;
  created_on: string;
  modified_on: string;
  redirect_url?: string | null;
}

// Interface for pagination info
interface ResultInfo {
  page: number;
  per_page: number;
  count: number;
  total_count: number;
  total_pages: number;
}

// Interface for tracking scan progress
interface ScanProgress {
  id?: number; // Add id field
  scan_id: string;
  status: string;
  current_page: number;
  total_pages: number | null;
  domains_processed: number;
  total_domains: number | null;
  started_at: string;
  updated_at: string;
  completed_at?: string | null; // Allow null
  is_active: boolean;
  error_message?: string;
}

// Configure for edge runtime
export const runtime = 'edge';
// Disable static generation to ensure fresh data on each request
export const dynamic = 'force-dynamic';

// --- Configuration for Resumable Scan ---
const PAGES_PER_RUN = 10; // Process 10 pages per execution to avoid timeouts
// ----------------------------------------

/**
 * Logger function for debugging - writes to console
 */
// Define a type for the optional data payload
type LogData = Record<string, unknown> | string | number | boolean | null | undefined;

async function cronLogger(message: string, data?: LogData, scanId?: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}]${scanId ? ` [Scan ${scanId}]` : ''} CRON SYNC: ${message}`;

  // Always log to console
  console.log(logMessage);
  if (data !== undefined && data !== null) console.log(JSON.stringify(data, null, 2)); // Check for undefined/null

  try {
    // In Edge runtime, we can't write to file system, but we can log more details
    if (process.env.NODE_ENV === 'development') {
      console.log('=== CRON DEBUG LOG ===');
      console.log(`Environment: ${process.env.NODE_ENV}`);
      console.log(`Message: ${message}`);
      if (data !== undefined && data !== null) console.log(`Data: ${JSON.stringify(data, null, 2)}`); // Check for undefined/null
      console.log('=====================');
    }
  } catch (error) {
    console.error('Error in cronLogger:', error);
  }
}

/**
 * Update the scan progress in the database
 */
async function updateScanProgress(
  supabase: SupabaseClient, // Use SupabaseClient type
  progress: Partial<ScanProgress>,
  scanId: string
) {
  try {
    const updatedFields = {
      ...progress,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('scan_progress')
      .update(updatedFields)
      .eq('scan_id', scanId);

    if (error) {
      // Log specific error details if available
      await cronLogger('Error updating scan progress', { error: error.message, details: error.details, hint: error.hint }, scanId);
    }

    return !error;
  } catch (error) {
    await cronLogger('Exception updating scan progress', { error: error instanceof Error ? error.message : error }, scanId);
    return false;
  }
}

/**
 * Create a new scan progress record to track an active scan
 */
async function initScanProgress(
  supabase: SupabaseClient, // Use SupabaseClient type
  scanId: string,
  startPage: number,
  initialDomainsProcessed: number,
  initialTotalPages: number | null,
  initialTotalDomains: number | null
): Promise<boolean> {
  try {
    const timestamp = new Date().toISOString();

    const { error } = await supabase
      .from('scan_progress')
      .insert({
        scan_id: scanId,
        status: 'initializing',
        current_page: startPage > 1 ? startPage - 1 : 0, // Start from previous page if resuming
        total_pages: initialTotalPages,
        domains_processed: initialDomainsProcessed,
        total_domains: initialTotalDomains,
        started_at: timestamp,
        updated_at: timestamp,
        is_active: true,
        completed_at: null // Explicitly set completed_at to null
      });

    if (error) {
      await cronLogger('Error creating scan progress record', { error: error.message, details: error.details, hint: error.hint }, scanId);
      return false;
    }

    return true;
  } catch (error) {
    await cronLogger('Exception creating scan progress record', { error: error instanceof Error ? error.message : error }, scanId);
    return false;
  }
}

/**
 * Complete or pause a scan by updating its status
 */
async function finalizeScan(
  supabase: SupabaseClient, // Use SupabaseClient type
  scanId: string,
  status: 'completed' | 'failed' | 'processing', // Allow 'processing' for pause
  finalDomainsProcessed: number,
  finalCurrentPage: number, // Track the last processed page
  totalPages: number | null,
  errorMessage?: string
) {
  const timestamp = new Date().toISOString();
  const isCompleteOrFailed = status === 'completed' || status === 'failed';

  // Only mark other scans inactive if this one is truly finishing or failing
  // And ensure we don't mark the current one inactive prematurely if pausing
  if (isCompleteOrFailed) {
      await supabase
          .from('scan_progress')
          .update({ is_active: false, updated_at: timestamp })
          .eq('is_active', true)
          .neq('scan_id', scanId); // Don't mark the current one inactive yet
  }

  // Update the current scan
  await updateScanProgress(supabase, {
    status,
    domains_processed: finalDomainsProcessed,
    current_page: finalCurrentPage, // Save the last processed page
    total_pages: totalPages, // Ensure total_pages is saved
    is_active: !isCompleteOrFailed, // Keep active if paused ('processing')
    completed_at: isCompleteOrFailed ? timestamp : null, // Set completed_at only if finished/failed
    error_message: errorMessage
  }, scanId);

  await cronLogger(`Scan finalized with status: ${status}`, { scanId, finalCurrentPage, totalPages, finalDomainsProcessed });
}


/**
 * Process a single page of Cloudflare domains
 */
async function processDomainPage(
  supabase: SupabaseClient, // Use SupabaseClient type
  domains: CloudflareDomain[],
  timestamp: string
): Promise<number> {
  if (!domains || !domains.length) return 0; // Add null check

  // Prepare domains for insertion/update in Supabase
  const domainsForDB = domains.map((domain: CloudflareDomain) => ({
    cloudflare_id: domain.id,
    name: domain.name,
    status: domain.status,
    paused: domain.paused,
    type: domain.type || 'unknown',
    created_on: domain.created_on,
    modified_on: domain.modified_on,
    last_synced: timestamp,
    redirect_url: domain.redirect_url || null // Include redirect URL from zone-management
  }));

  // Upsert domains to Supabase
  const { error } = await supabase
    .from('domains')
    .upsert(domainsForDB, {
      onConflict: 'cloudflare_id',
      ignoreDuplicates: false
    });

  if (error) {
    // Throw specific error to be caught by the main handler
    throw new Error(`Failed to upsert domains: ${error.message} (Code: ${error.code})`);
  }

  return domains.length;
}

/**
 * Main handler for GET requests
 */
export async function GET(request: Request) {
  const startTime = performance.now();
  const requestHeaders: Record<string, string> = {}; // Use const as it's not reassigned

  // Generate a timestamp for all operations
  const timestamp = new Date().toISOString();
  // Generate a unique ID for this scan execution
  const currentRunScanId = uuidv4(); // ID for this specific function execution

  // Log all request headers for debugging
  request.headers.forEach((value, key) => {
    requestHeaders[key] = value;
  });

  await cronLogger('CRON JOB TRIGGERED', {
    timestamp,
    scanId: currentRunScanId, // Log the ID for this run
    url: request.url,
    method: request.method,
    headers: requestHeaders
  });

  let supabase: SupabaseClient | null = null; // Initialize supabase client variable
  let lastScan: ScanProgress | null = null; // To store state of the last scan attempt
  let startPage = 1;
  let initialDomainsProcessed = 0;
  let initialTotalPages: number | null = null;
  let initialTotalDomains: number | null = null;
  let isResuming = false;

  try {
    // Get the Cron secret from environment
    const validCronSecret = process.env.CRON_SECRET || 'dns-fd-R2wQ9p7X4sK8tL3zY6mN1bV5cX2zZ9mN8bV6xC3';

    // Supabase credentials directly from environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase URL or Service Role Key is missing in environment variables.');
    }

    // Initialize Supabase client
    supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify request is from Vercel Cron or authorized
    const userAgent = request.headers.get('user-agent') || '';
    const isVercelCron = userAgent.includes('vercel-cron'); // Simpler check might suffice
    const authHeader = request.headers.get('Authorization');
    const url = new URL(request.url);
    const keyParam = url.searchParams.get('key');
    const hasValidToken = authHeader?.startsWith('Bearer ') && authHeader.substring(7) === validCronSecret;
    const hasValidKeyParam = keyParam === validCronSecret;
    const isDebugMode = url.searchParams.get('debug') === 'true'; // Keep debug mode
    const isSetupMode = url.searchParams.get('setup') === 'true'; // Keep setup mode

    // Allow debug mode without key for easier local testing
    if (!isVercelCron && !hasValidToken && !hasValidKeyParam && !isDebugMode) {
      await cronLogger('Unauthorized access attempt', { userAgent, url: request.url, hasAuthHeader: !!authHeader, hasKeyParam: !!keyParam }, currentRunScanId);
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await cronLogger('Authorization successful', { isVercelCron, hasValidToken, hasValidKeyParam, isDebugMode }, currentRunScanId);

    // --- Check for previous incomplete scan ---
    const { data: lastScanData, error: lastScanError } = await supabase
        .from('scan_progress')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(); // Use maybeSingle to handle no previous scans gracefully

    if (lastScanError) {
        await cronLogger('Error fetching last scan progress', { error: lastScanError.message }, currentRunScanId);
        // Decide if we should proceed or throw? Let's proceed for now, starting fresh.
    } else if (lastScanData) {
        lastScan = lastScanData as ScanProgress;
        await cronLogger('Found last scan record', { lastScanId: lastScan.scan_id, status: lastScan.status, currentPage: lastScan.current_page, totalPages: lastScan.total_pages }, currentRunScanId);
        // Check if the last scan was incomplete and needs resuming
        if (lastScan.status !== 'completed' && lastScan.status !== 'failed' && lastScan.total_pages && lastScan.current_page < lastScan.total_pages) {
            startPage = lastScan.current_page + 1;
            initialDomainsProcessed = lastScan.domains_processed || 0; // Use || 0 as fallback
            initialTotalPages = lastScan.total_pages;
            initialTotalDomains = lastScan.total_domains;
            isResuming = true;
            await cronLogger('Resuming previous scan', { resumeFromPage: startPage, initialDomainsProcessed }, currentRunScanId);
        } else {
             await cronLogger('Last scan was completed or failed, starting fresh.', { status: lastScan.status }, currentRunScanId);
        }
    } else {
         await cronLogger('No previous scan found, starting fresh.', {}, currentRunScanId);
    }
    // -----------------------------------------

    // Mark any potentially stuck active scans as inactive before starting new one
    const { error: updateError } = await supabase
        .from('scan_progress')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('is_active', true);

    if (updateError) {
         await cronLogger('Warning: Failed to mark old active scans as inactive', { error: updateError.message }, currentRunScanId);
    }


    // Initialize the scan progress tracking for this run
    const progressInitialized = await initScanProgress(
        supabase,
        currentRunScanId,
        startPage,
        initialDomainsProcessed,
        initialTotalPages,
        initialTotalDomains
    );

    if (!progressInitialized) {
      // If init fails, we can't proceed. finalizeScan won't work as the record doesn't exist.
      throw new Error('Failed to initialize scan progress tracking');
    }
    await cronLogger('Initialized new scan progress tracking', { scanId: currentRunScanId, startPage, initialDomainsProcessed }, currentRunScanId);


    // --- Setup Mode Check ---
    if (isSetupMode) {
        // Run setup logic (simplified - assumes tables might exist)
        await cronLogger('Running in setup mode - ensuring tables exist', {}, currentRunScanId);
        // Minimal check/create for domains table
        const { error: domainCheckErr } = await supabase.from('domains').select('id', { count: 'exact', head: true });
        if (domainCheckErr && domainCheckErr.code === '42P01') {
             await cronLogger('Domains table missing, attempting creation via placeholder', {}, currentRunScanId);
             await supabase.from('domains').insert({ cloudflare_id: 'setup-placeholder', name: 'setup.example.com', status: 'active', paused: false, type: 'setup', created_on: timestamp, modified_on: timestamp, last_synced: timestamp });
             await supabase.from('domains').delete().eq('cloudflare_id', 'setup-placeholder');
        }
         // Minimal check/create for sync_history table
        const { error: historyCheckErr } = await supabase.from('sync_history').select('id', { count: 'exact', head: true });
         if (historyCheckErr && historyCheckErr.code === '42P01') {
             await cronLogger('Sync history table missing, attempting creation via placeholder', {}, currentRunScanId);
             await supabase.from('sync_history').insert({ timestamp: timestamp, domains_count: 0, success: true, error_message: 'Initial setup record', duration_ms: 0 });
         }
         // Minimal check/create for scan_progress table (already implicitly checked by initScanProgress)

        await finalizeScan(supabase, currentRunScanId, 'completed', 0, 0, 0, undefined); // Mark setup scan as completed
        const durationMs = Math.round(performance.now() - startTime);
        return NextResponse.json({ success: true, message: 'Setup mode completed.', scan_id: currentRunScanId, duration_ms: durationMs });
    }
    // -----------------------


    // Update scan progress to "fetching" (or processing if resuming)
    await updateScanProgress(supabase, { status: isResuming ? 'processing' : 'fetching', current_page: startPage }, currentRunScanId);

    // For edge runtime, we need to use absolute URLs
    const origin = url.origin; // Get the current origin

    // Initial variables for pagination
    let currentPage = startPage; // Start from the determined page
    let totalPages = initialTotalPages; // Use value from resumed scan if available
    let totalDomains = initialTotalDomains; // Use value from resumed scan if available
    let domainsProcessed = initialDomainsProcessed; // Start count from resumed scan
    const perPage = 100; // Maximum allowed by Cloudflare API
    const allFetchedCloudflareIds: string[] = []; // Still needed for cleanup IF the whole process finishes

    // Determine the end page for this specific run
    // Need totalPages first. Fetch page 1 if unknown.
    if (totalPages === null) {
        const page1Url = `${origin}/api/cloudflare/zone-management?page=1&per_page=${perPage}`;
        await cronLogger('Fetching page 1 to get pagination info', { apiUrl: page1Url }, currentRunScanId);
        const page1Response = await fetch(page1Url, { headers: { ...(authHeader ? { 'Authorization': authHeader } : {}) } });
        if (!page1Response.ok) throw new Error(`Failed to fetch domains (page 1 for totals): HTTP ${page1Response.status}`);
        const page1Data = await page1Response.json();
        if (!page1Data.success) throw new Error(`Failed to fetch domains (page 1 for totals): ${page1Data.error || 'Unknown error'}`);
        const resultInfo: ResultInfo = page1Data.resultInfo;
        totalPages = resultInfo?.total_pages || 1;
        totalDomains = resultInfo?.total_count || (page1Data.domains?.length || 0);
        await cronLogger('Retrieved pagination info', { totalPages, totalDomains }, currentRunScanId);
        await updateScanProgress(supabase, { total_pages: totalPages, total_domains: totalDomains }, currentRunScanId);
    }

    // Now calculate the end page for this run
    const endPageForThisRun = Math.min(startPage + PAGES_PER_RUN - 1, totalPages || Number.MAX_SAFE_INTEGER);

    await cronLogger('Beginning paginated domain sync for this run', { startPage, endPageForThisRun, totalPages: totalPages ?? 'Unknown' }, currentRunScanId);

    // If starting fresh (page 1), process page 1 data if we fetched it for totals
    if (startPage === 1 && currentPage === 1 && endPageForThisRun >= 1) {
        // Re-fetch page 1 data if not already available (e.g., if totals were known from resume)
        // This part needs refinement - avoid re-fetching if possible. Assume we have page1Data if startPage was 1.
        // Let's simplify: Assume if startPage is 1, we *always* fetch and process page 1 first before the loop.
        const page1Url = `${origin}/api/cloudflare/zone-management?page=1&per_page=${perPage}`;
        await cronLogger('Processing page 1 before loop', { apiUrl: page1Url }, currentRunScanId);
        const page1Response = await fetch(page1Url, { headers: { ...(authHeader ? { 'Authorization': authHeader } : {}) } });
        if (!page1Response.ok) throw new Error(`Failed to fetch domains (page 1): HTTP ${page1Response.status}`);
        const page1Data = await page1Response.json();
        if (!page1Data.success) throw new Error(`Failed to fetch domains (page 1): ${page1Data.error || 'Unknown error'}`);

        const firstPageDomains = page1Data.domains || [];
        firstPageDomains.forEach((domain: CloudflareDomain) => allFetchedCloudflareIds.push(domain.id));
        const domainsOnFirstPage = await processDomainPage(supabase, firstPageDomains, timestamp);
        domainsProcessed += domainsOnFirstPage; // Update count
        await updateScanProgress(supabase, { current_page: 1, domains_processed: domainsProcessed, status: 'processing' }, currentRunScanId);
        await cronLogger(`Processed page 1/${totalPages}`, { domainsOnPage: domainsOnFirstPage, totalProcessed: domainsProcessed, progress: `${Math.round((domainsProcessed / (totalDomains || 1)) * 100)}%` }, currentRunScanId);
        currentPage++; // Increment current page to start loop from page 2
    } else if (startPage > 1) {
         await updateScanProgress(supabase, { status: 'processing' }, currentRunScanId); // Ensure status is processing if resuming
    }


    // Fetch and process remaining pages for THIS RUN
    for (; currentPage <= endPageForThisRun && currentPage <= (totalPages || Number.MAX_SAFE_INTEGER); currentPage++) {
        // Check elapsed time - exit gracefully if approaching timeout (e.g., > 50 seconds for a 60s limit)
        const elapsedMs = performance.now() - startTime;
        // Vercel Hobby timeout is 10s(now 15s free), Pro is 60s, Enterprise up to 900s. Let's use a buffer.
        const timeLimitBufferMs = 5000; // 5 second buffer
        // Determine timeout based on Vercel plan env var or default to Pro (60s) for safety
        let assumedTimeoutMs = 60000; // Default to Pro
        if (process.env.VERCEL_PLAN === 'hobby' || process.env.VERCEL_ENV === 'preview') {
             assumedTimeoutMs = 15000; // Hobby/Preview timeout
        } else if (process.env.VERCEL_PLAN === 'enterprise') {
             assumedTimeoutMs = 900000; // Enterprise timeout
        }

        if (elapsedMs > assumedTimeoutMs - timeLimitBufferMs) {
            await cronLogger('Approaching function timeout limit, pausing execution.', { elapsedMs, assumedTimeoutMs }, currentRunScanId);
            break; // Exit the loop prematurely
        }

        await updateScanProgress(supabase, { current_page: currentPage }, currentRunScanId); // Update page number before fetch

        const pageUrl = `${origin}/api/cloudflare/zone-management?page=${currentPage}&per_page=${perPage}`;
        await cronLogger(`Fetching page ${currentPage}/${totalPages}`, { apiUrl: pageUrl }, currentRunScanId);

        try {
            const pageResponse = await fetch(pageUrl, { headers: { ...(authHeader ? { 'Authorization': authHeader } : {}) } });
            if (!pageResponse.ok) throw new Error(`Failed to fetch domains on page ${currentPage}: HTTP ${pageResponse.status}`);

            const pageData = await pageResponse.json();
            if (!pageData.success) throw new Error(`Failed to fetch domains on page ${currentPage}: ${pageData.error || 'Unknown error'}`);

            const pageDomains = pageData.domains || [];
            pageDomains.forEach((domain: CloudflareDomain) => allFetchedCloudflareIds.push(domain.id)); // Collect IDs for potential cleanup later

            const domainsOnThisPage = await processDomainPage(supabase, pageDomains, timestamp);
            domainsProcessed += domainsOnThisPage;

            // Update progress *after* successful processing of the page
            await updateScanProgress(supabase, { domains_processed: domainsProcessed }, currentRunScanId);
            await cronLogger(`Processed page ${currentPage}/${totalPages}`, { domainsOnPage: domainsOnThisPage, totalProcessed: domainsProcessed, progress: `${Math.round((domainsProcessed / (totalDomains || 1)) * 100)}%` }, currentRunScanId);

        } catch (pageError) {
            await cronLogger(`Error processing page ${currentPage}`, { error: pageError instanceof Error ? pageError.message : pageError }, currentRunScanId);
            // Stop the run on page error
            throw pageError; // Re-throw to be caught by the main try-catch
        }
    }

    // --- Finalize Run ---
    const finalCurrentPageProcessed = currentPage - 1; // The last page successfully processed or attempted in this run

    if (totalPages !== null && finalCurrentPageProcessed >= totalPages) {
        // ---- All pages processed across all runs ----
        await cronLogger('All pages processed.', { totalPages, finalCurrentPageProcessed }, currentRunScanId);

        // ---> Run Cleanup Logic <---
        // IMPORTANT: Cleanup logic needs refinement for resumable scans.
        // It currently only considers IDs fetched in the *last* run.
        // A robust solution requires storing all IDs across runs or fetching all IDs again before cleanup.
        // Skipping cleanup for now to prevent accidental data loss.
        await cronLogger('Skipping stale domain cleanup in resumable mode (requires persistent ID storage or full ID refetch)', {}, currentRunScanId);
        // if (domainsProcessed > 0 && allFetchedCloudflareIds.length > 0) { ... cleanup logic ... }
        // ---> END Cleanup Logic <---

        // Mark scan as completed
        await finalizeScan(supabase, currentRunScanId, 'completed', domainsProcessed, finalCurrentPageProcessed, totalPages, undefined);

        // Create a sync history record for the completed multi-part scan
        const durationMs = Math.round(performance.now() - startTime);
        await cronLogger('Creating sync history record for completed scan', { timestamp, domainsCount: domainsProcessed, durationMs, scanId: currentRunScanId }, currentRunScanId);
        const { error: syncRecordError } = await supabase
          .from('sync_history')
          .insert({ timestamp: timestamp, domains_count: domainsProcessed, success: true, duration_ms: durationMs });
        if (syncRecordError) {
          await cronLogger('Failed to create sync record', { syncRecordError }, currentRunScanId);
        }

        await cronLogger(`Sync completed successfully in ${durationMs}ms`, { totalPages: totalPages, pagesProcessed: finalCurrentPageProcessed, domainsProcessed: domainsProcessed }, currentRunScanId);

        return NextResponse.json({
          success: true,
          message: `Synchronized ${domainsProcessed} domains from Cloudflare to Supabase (Completed)`,
          scan_id: currentRunScanId,
          timestamp: timestamp,
          duration_ms: durationMs,
          pages_processed_this_run: finalCurrentPageProcessed - startPage + 1,
          total_pages: totalPages
        });

    } else {
        // ---- Pausing execution for this run ----
        await cronLogger('Reached page limit or timeout for this run, pausing.', { finalCurrentPageProcessed, totalPages: totalPages ?? 'Unknown', pagesPerRun: PAGES_PER_RUN }, currentRunScanId);
        // Mark scan as still processing, ready for the next run
        await finalizeScan(supabase, currentRunScanId, 'processing', domainsProcessed, finalCurrentPageProcessed, totalPages, undefined);

        const durationMs = Math.round(performance.now() - startTime);
        await cronLogger(`Sync run paused successfully in ${durationMs}ms`, { pagesProcessedThisRun: finalCurrentPageProcessed - startPage + 1 }, currentRunScanId);

        // Don't add to sync_history until fully complete
        return NextResponse.json({
          success: true,
          message: `Synchronized domains up to page ${finalCurrentPageProcessed}. Run paused, will resume next cycle.`,
          scan_id: currentRunScanId,
          timestamp: timestamp,
          duration_ms: durationMs,
          pages_processed_this_run: finalCurrentPageProcessed - startPage + 1,
          total_pages: totalPages
        });
    }

  } catch (error) {
     await cronLogger('Error during sync', { error: error instanceof Error ? error.message : 'Unknown error', stack: error instanceof Error ? error.stack : undefined }, currentRunScanId);
     const durationMs = Math.round(performance.now() - startTime);

     // Try to record the failed sync if supabase client was initialized
     if (supabase) {
         try {
             await cronLogger('Recording failed sync in database', {}, currentRunScanId);
             // Use finalizeScan to mark as failed
             await finalizeScan(
                 supabase,
                 currentRunScanId,
                 'failed',
                 initialDomainsProcessed, // Use initial count as progress is uncertain
                 startPage > 1 ? startPage - 1 : 0, // Record the page it likely failed on/before
                 initialTotalPages, // Record total pages if known
                 error instanceof Error ? error.message : 'Unknown error'
             );

             // Add to sync_history as failed
             await supabase
                 .from('sync_history')
                 .insert({
                     timestamp: timestamp,
                     domains_count: initialDomainsProcessed, // Log domains processed before failure if possible
                     success: false,
                     error_message: error instanceof Error ? error.message : 'Unknown error',
                     duration_ms: durationMs
                 });
         } catch (dbError) {
             await cronLogger('Failed to record sync error in database', { dbError: dbError instanceof Error ? dbError.message : dbError }, currentRunScanId);
         }
     }

     return NextResponse.json(
       { success: false, error: error instanceof Error ? error.message : 'Unknown error', scan_id: currentRunScanId, timestamp: timestamp, duration_ms: durationMs },
       { status: 500 }
     );
  }
}