import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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
  scan_id: string;
  status: string;
  current_page: number;
  total_pages: number | null;
  domains_processed: number;
  total_domains: number | null;
  started_at: string;
  updated_at: string;
  completed_at?: string;
  is_active: boolean;
  error_message?: string;
}

// Configure for edge runtime
export const runtime = 'edge';
// Disable static generation to ensure fresh data on each request
export const dynamic = 'force-dynamic';

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
  if (data) console.log(JSON.stringify(data, null, 2));
  
  try {
    // In Edge runtime, we can't write to file system, but we can log more details
    if (process.env.NODE_ENV === 'development') {
      console.log('=== CRON DEBUG LOG ===');
      console.log(`Environment: ${process.env.NODE_ENV}`);
      console.log(`Message: ${message}`);
      if (data) console.log(`Data: ${JSON.stringify(data, null, 2)}`);
      console.log('=====================');
    }
  } catch (error) {
    console.error('Error in cronLogger:', error);
  }
}

/**
 * Update the scan progress in the database
 */
// Define a type for the Supabase client (import from @supabase/supabase-js if possible)
import { SupabaseClient } from '@supabase/supabase-js';

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
      console.error('Error updating scan progress:', error);
    }
    
    return !error;
  } catch (error) {
    console.error('Exception updating scan progress:', error);
    return false;
  }
}

/**
 * Create a new scan progress record to track an active scan
 */
async function initScanProgress(
  supabase: SupabaseClient, // Use SupabaseClient type
  scanId: string
): Promise<boolean> {
  try {
    const timestamp = new Date().toISOString();
    
    const { error } = await supabase
      .from('scan_progress')
      .insert({
        scan_id: scanId,
        status: 'initializing',
        current_page: 0,
        total_pages: null,
        domains_processed: 0,
        total_domains: null,
        started_at: timestamp,
        updated_at: timestamp,
        is_active: true
      });
    
    if (error) {
      console.error('Error creating scan progress record:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Exception creating scan progress record:', error);
    return false;
  }
}

/**
 * Complete a scan by updating its status and marking it inactive
 */
async function completeScan(
  supabase: SupabaseClient, // Use SupabaseClient type
  scanId: string,
  status: string,
  domainsProcessed: number,
  errorMessage?: string
) {
  const timestamp = new Date().toISOString();
  
  // First mark any existing active scans as inactive
  await supabase
    .from('scan_progress')
    .update({ is_active: false })
    .eq('is_active', true);

  // Then complete the current scan
  await updateScanProgress(supabase, {
    status,
    domains_processed: domainsProcessed,
    is_active: false,
    completed_at: timestamp,
    error_message: errorMessage
  }, scanId);

  console.log(`[Scan ${scanId}] Completed with status: ${status}`);
}

/**
 * Process a single page of Cloudflare domains
 */
async function processDomainPage(
  supabase: SupabaseClient, // Use SupabaseClient type
  domains: CloudflareDomain[],
  timestamp: string
): Promise<number> {
  if (!domains.length) return 0;
  
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
    throw new Error(`Failed to upsert domains: ${error.message}`);
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
  // Generate a unique ID for this scan
  const scanId = uuidv4(); // Keep scanId as it's used throughout

  // Log all request headers for debugging
  request.headers.forEach((value, key) => {
    requestHeaders[key] = value;
  });
  
  await cronLogger('CRON JOB TRIGGERED', {
    timestamp,
    scanId,
    url: request.url,
    method: request.method,
    headers: requestHeaders
  });
  
  try {
    // Get the Cron secret from environment
    const validCronSecret = process.env.CRON_SECRET || 'dns-fd-R2wQ9p7X4sK8tL3zY6mN1bV5cX2zZ9mN8bV6xC3';
    
    // Supabase credentials directly from environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    // Verify request is from Vercel Cron
    const userAgent = request.headers.get('user-agent') || '';
    const isVercelCron = userAgent.includes('vercel-cron') && request.headers.get('x-vercel-cron') === 'true';
    
    await cronLogger('Verification check', { 
      userAgent, 
      isVercelCron,
      environment: process.env.NODE_ENV 
    }, scanId);
    
    // Check for authorization header as a fallback for manual testing
    const authHeader = request.headers.get('Authorization');
    let hasValidToken = false;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      hasValidToken = token === validCronSecret;
      
      await cronLogger('Token verification', { 
        hasToken: !!authHeader, 
        isValid: hasValidToken,
        tokenLength: token.length
      }, scanId);
    }
    
    // Also check URL parameters as a final fallback
    const url = new URL(request.url);
    const keyParam = url.searchParams.get('key');
    const hasValidKeyParam = keyParam === validCronSecret;
    const isDebugMode = url.searchParams.get('debug') === 'true';
    const isSetupMode = url.searchParams.get('setup') === 'true';
    const fullScanMode = url.searchParams.get('full') !== 'false'; // Default to full scan
    
    // Only allow requests from Vercel Cron or with valid token/key or in debug mode
    if (!isVercelCron && !hasValidToken && !hasValidKeyParam) {
      await cronLogger('Unauthorized access attempt', { 
        userAgent, 
        url: request.url,
        hasAuthHeader: !!authHeader,
        hasKeyParam: !!keyParam
      }, scanId);
      
      return NextResponse.json(
        { success: false, error: 'Unauthorized', isDebug: isDebugMode },
        { status: 401 }
      );
    }
    
    await cronLogger('Starting Cloudflare to Supabase synchronization', {
      fullScan: fullScanMode
    }, scanId);
    
    // Initialize Supabase client with direct credentials
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Create a placeholder domain to ensure the tables exist (auto-schema)
    if (isSetupMode || isDebugMode) {
      await cronLogger('Ensuring domains table exists (auto-schema)', {}, scanId);
      try {
        // First check if the table already exists
        const { error: checkError } = await supabase // Remove unused 'checkData'
          .from('domains')
          .select('id', { count: 'exact', head: true }); // More efficient check

        if (checkError && checkError.code === '42P01') {
          // Table doesn't exist, create a placeholder
          const placeholderDomain = {
            cloudflare_id: 'placeholder-setup',
            name: 'placeholder.example.com',
            status: 'placeholder',
            paused: false,
            type: 'placeholder',
            created_on: timestamp,
            modified_on: timestamp,
            last_synced: timestamp
          };
          
          const { error: createError } = await supabase
            .from('domains')
            .insert(placeholderDomain);
          
          if (createError) {
            await cronLogger('Error creating placeholder domain', { createError }, scanId);
          } else {
            await cronLogger('Created placeholder domain to initialize table', {}, scanId);
            
            // Clean up the placeholder
            await supabase
              .from('domains')
              .delete()
              .eq('cloudflare_id', 'placeholder-setup');
          }
        }
      } catch (schemaError) {
        await cronLogger('Error during table setup', { schemaError }, scanId);
      }
    }
    
    // Now do the same for sync_history table if needed
    if (isSetupMode || isDebugMode) {
      await cronLogger('Ensuring sync_history table exists (auto-schema)', {}, scanId);
      try {
        // First check if the table already exists
        const { error: checkError } = await supabase // Remove unused 'checkData'
          .from('sync_history')
          .select('id', { count: 'exact', head: true }); // More efficient check

        if (checkError && checkError.code === '42P01') {
          // Table doesn't exist, create it with a placeholder
          const placeholderRecord = {
            timestamp: timestamp,
            domains_count: 0,
            success: true,
            error_message: 'Initial setup record',
            duration_ms: 0
          };
          
          const { error: createError } = await supabase
            .from('sync_history')
            .insert(placeholderRecord);
          
          if (createError) {
            await cronLogger('Error creating sync_history placeholder', { createError }, scanId);
          } else {
            await cronLogger('Created placeholder sync record to initialize table', {}, scanId);
          }
        }
      } catch (schemaError) {
        await cronLogger('Error during sync_history table setup', { schemaError }, scanId);
      }
    }

    // Check if scan_progress table exists
    try {
      await cronLogger('Ensuring scan_progress table exists (auto-schema)', {}, scanId);
      const { error: checkError } = await supabase // Remove unused 'checkData'
        .from('scan_progress')
        .select('id', { count: 'exact', head: true }); // More efficient check

      if (checkError && checkError.code === '42P01') {
        await cronLogger('scan_progress table does not exist, please run create-scan-progress-table.sql', {}, scanId);
      }
    } catch (schemaError) {
      await cronLogger('Error checking scan_progress table', { schemaError }, scanId);
    }
    
    // First mark any existing active scans as inactive
    await supabase
      .from('scan_progress')
      .update({ is_active: false })
      .eq('is_active', true);

    // Initialize the scan progress tracking
    const progressInitialized = await initScanProgress(supabase, scanId);
    if (!progressInitialized) {
      await cronLogger('Failed to initialize scan progress tracking', {}, scanId);
    } else {
      await cronLogger('Initialized new scan progress tracking', { scanId }, scanId);
    }
    
    // In setup-only mode, we can skip the actual domain fetch
    if (isSetupMode && !isDebugMode) {
      // Record sync duration
      const durationMs = Math.round(performance.now() - startTime);
      
      // Complete the scan (even though it's just setup)
      await completeScan(supabase, scanId, 'completed', 0);
      
      return NextResponse.json({
        success: true,
        message: 'Tables setup completed successfully',
        scan_id: scanId,
        timestamp: timestamp,
        duration_ms: durationMs,
        debug: {
          isVercelCron,
          environment: process.env.NODE_ENV,
          isDebugMode,
          isSetupMode
        }
      });
    }
    
    // Update scan progress to "fetching"
    await updateScanProgress(supabase, { 
      status: 'fetching', 
      current_page: 1 
    }, scanId);
    
    // For edge runtime, we need to use absolute URLs
    const origin = url.origin; // Get the current origin (e.g., http://localhost:3000)
    
    // Initial variables for pagination
    let currentPage = 1;
    let totalPages = 1;
    let totalDomains = 0;
    let domainsProcessed = 0;
    const perPage = 100; // Maximum allowed by Cloudflare API
    const allFetchedCloudflareIds: string[] = []; // <--- Add this line to collect valid IDs
    
    // If not in full scan mode, only process the first page
    const maxPages = fullScanMode ? Number.MAX_SAFE_INTEGER : 1;
    
    // Start the paginated fetching process
    await cronLogger('Beginning paginated domain sync', { 
      fullScan: fullScanMode,
      perPage
    }, scanId);
    
    // Fetch first page to get pagination info
    const firstPageUrl = `${origin}/api/cloudflare/zone-management?page=${currentPage}&per_page=${perPage}`;
    await cronLogger('Fetching first page', { apiUrl: firstPageUrl }, scanId);
    
    const firstPageResponse = await fetch(firstPageUrl, {
      headers: {
        ...(authHeader ? { 'Authorization': authHeader } : {})
      }
    });
    
    if (!firstPageResponse.ok) {
      throw new Error(`Failed to fetch domains: HTTP ${firstPageResponse.status}`);
    }
    
    const firstPageData = await firstPageResponse.json();
    
    if (!firstPageData.success) {
      throw new Error(`Failed to fetch domains: ${firstPageData.error || 'Unknown error'}`);
    }
    
    const firstPageDomains = firstPageData.domains || [];
    const resultInfo: ResultInfo = firstPageData.resultInfo;

    // Collect IDs from the first page
    firstPageDomains.forEach((domain: CloudflareDomain) => allFetchedCloudflareIds.push(domain.id)); // <--- Collect IDs
    
    totalPages = resultInfo?.total_pages || 1;
    totalDomains = resultInfo?.total_count || firstPageDomains.length;
    
    await cronLogger('Retrieved pagination info', { 
      totalPages,
      totalDomains,
      firstPageCount: firstPageDomains.length
    }, scanId);
    
    // Update scan progress with total information
    await updateScanProgress(supabase, {
      total_pages: totalPages,
      total_domains: totalDomains,
      status: 'processing'
    }, scanId);
    
    // Process the first page of domains
    domainsProcessed += await processDomainPage(supabase, firstPageDomains, timestamp);
    await updateScanProgress(supabase, { 
      current_page: currentPage, 
      domains_processed: domainsProcessed 
    }, scanId);
    
    await cronLogger(`Processed page ${currentPage}/${totalPages}`, { 
      domainsOnPage: firstPageDomains.length,
      totalProcessed: domainsProcessed,
      progress: `${Math.round((domainsProcessed / totalDomains) * 100)}%`
    }, scanId);
    
    // Fetch and process remaining pages if required
    if (fullScanMode && totalPages > 1 && currentPage < maxPages) {
      for (currentPage = 2; currentPage <= totalPages && currentPage <= maxPages; currentPage++) {
        await updateScanProgress(supabase, { 
          status: 'processing', 
          current_page: currentPage 
        }, scanId);
        
        const pageUrl = `${origin}/api/cloudflare/zone-management?page=${currentPage}&per_page=${perPage}`;
        await cronLogger(`Fetching page ${currentPage}/${totalPages}`, { apiUrl: pageUrl }, scanId);
        
        try {
          const pageResponse = await fetch(pageUrl, {
            headers: {
              ...(authHeader ? { 'Authorization': authHeader } : {})
            }
          });
          
          if (!pageResponse.ok) {
            throw new Error(`Failed to fetch domains on page ${currentPage}: HTTP ${pageResponse.status}`);
          }
          
          const pageData = await pageResponse.json();
          
          if (!pageData.success) {
            throw new Error(`Failed to fetch domains on page ${currentPage}: ${pageData.error || 'Unknown error'}`);
          }
          
          const pageDomains = pageData.domains || [];

          // Collect IDs from the current page
          pageDomains.forEach((domain: CloudflareDomain) => allFetchedCloudflareIds.push(domain.id)); // <--- Collect IDs

          const domainsOnThisPage = await processDomainPage(supabase, pageDomains, timestamp);
          domainsProcessed += domainsOnThisPage;
          
          await updateScanProgress(supabase, { domains_processed: domainsProcessed }, scanId);
          
          await cronLogger(`Processed page ${currentPage}/${totalPages}`, { 
            domainsOnPage: pageDomains.length,
            totalProcessed: domainsProcessed,
            progress: `${Math.round((domainsProcessed / totalDomains) * 100)}%`
          }, scanId);
        } catch (pageError) {
          await cronLogger(`Error processing page ${currentPage}`, { error: pageError }, scanId);
          // Continue with next page despite error
        }
      }
    }
    
    // ---> START: Add Cleanup Logic <---
    if (fullScanMode && domainsProcessed > 0 && allFetchedCloudflareIds.length > 0) { // Only cleanup if a full scan ran and processed domains and we have IDs
        await cronLogger('Starting cleanup of stale domains in Supabase', { totalValidIds: allFetchedCloudflareIds.length }, scanId);
        await updateScanProgress(supabase, { status: 'cleaning' }, scanId);

        try {
            // Delete domains from Supabase that were NOT found in the latest Cloudflare fetch
            const { error: deleteError } = await supabase
                .from('domains')
                .delete()
                .not('cloudflare_id', 'in', `(${allFetchedCloudflareIds.map(id => `'${id}'`).join(',')})`); // Use collected IDs

            if (deleteError) {
                await cronLogger('Error during stale domain cleanup', { deleteError }, scanId);
                // Don't throw, allow sync to complete, but log the error
            } else {
                await cronLogger('Successfully cleaned up stale domains', {}, scanId);
            }
        } catch (cleanupErr) {
            await cronLogger('Exception during stale domain cleanup', { error: cleanupErr instanceof Error ? cleanupErr.message : cleanupErr }, scanId);
        }
    } else {
        await cronLogger('Skipping stale domain cleanup', { fullScanMode, domainsProcessed, collectedIdsCount: allFetchedCloudflareIds.length }, scanId);
    }
    // ---> END: Add Cleanup Logic <---


    // Record sync duration
    const durationMs = Math.round(performance.now() - startTime);
    
    // Update scan progress to completed
    await completeScan(supabase, scanId, 'completed', domainsProcessed);
    
    // Create a sync record
    await cronLogger('Creating sync history record', { 
      timestamp, 
      domainsCount: domainsProcessed, 
      durationMs,
      scanId
    }, scanId);
    
    const { error: syncRecordError } = await supabase
      .from('sync_history')
      .insert({
        timestamp: timestamp,
        domains_count: domainsProcessed,
        success: true,
        duration_ms: durationMs
      });
    
    if (syncRecordError) {
      await cronLogger('Failed to create sync record', { syncRecordError }, scanId);
    }
    
    await cronLogger(`Sync completed successfully in ${durationMs}ms`, {
      totalPages: totalPages,
      pagesProcessed: currentPage - 1,
      domainsProcessed: domainsProcessed
    }, scanId);
    
    return NextResponse.json({
      success: true,
      message: `Synchronized ${domainsProcessed} domains from Cloudflare to Supabase`,
      scan_id: scanId,
      timestamp: timestamp,
      duration_ms: durationMs,
      pages_processed: currentPage - 1,
      total_pages: totalPages,
      debug: {
        isVercelCron,
        environment: process.env.NODE_ENV,
        isDebugMode,
        isSetupMode,
        fullScanMode
      }
    });
  } catch (error) {
    await cronLogger('Error during sync', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, scanId);
    
    // Calculate duration even for failed runs
    const durationMs = Math.round(performance.now() - startTime);
    
    // Try to record the failed sync
    try {
      await cronLogger('Recording failed sync in database', {}, scanId);
      
      // Supabase credentials from environment variables
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Mark the scan as failed
      await completeScan(
        supabase,
        scanId,
        'failed',
        0,
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      // First try to make sure the table exists
      try {
        // Check if sync_history table exists
        const { error: checkError } = await supabase // Remove unused 'checkData'
          .from('sync_history')
          .select('id', { count: 'exact', head: true }); // More efficient check

        if (checkError && checkError.code === '42P01') {
          // Table doesn't exist, create it with a placeholder
          await supabase
            .from('sync_history')
            .insert({
              timestamp: timestamp,
              domains_count: 0,
              success: true,
              error_message: 'Initial setup placeholder',
              duration_ms: 0
            });
        }
      } catch (tableError) {
        await cronLogger('Error ensuring sync_history table exists', { tableError }, scanId);
      }
      
      await supabase
        .from('sync_history')
        .insert({
          timestamp: timestamp,
          domains_count: 0,
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error',
          duration_ms: durationMs
        });
    } catch (dbError) {
      await cronLogger('Failed to record sync error in database', { dbError }, scanId);
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        scan_id: scanId,
        timestamp: timestamp,
        duration_ms: durationMs,
        debug: {
          env: process.env.NODE_ENV
        }
      },
      { status: 500 }
    );
  }
}