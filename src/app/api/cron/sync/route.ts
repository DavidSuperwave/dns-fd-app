import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Define the Cloudflare domain interface (as returned by the OPTIMIZED zone-management route)
interface CloudflareDomain {
    id: string;
    name: string;
    status: string;
    paused: boolean;
    type?: string;
    created_on: string;
    modified_on: string;
    redirect_url?: string | null; // Will be null from optimized GET
}

// Interface for pagination info from Cloudflare API
interface ResultInfo {
    page: number;
    per_page: number;
    count: number;
    total_count: number;
    total_pages: number;
}

// Interface for tracking scan progress in Supabase
interface ScanProgress {
    id?: number; // Optional: Supabase assigns this
    scan_id: string;
    status: 'initializing' | 'fetching' | 'processing' | 'completed' | 'failed';
    current_page: number; // Represents the *last successfully completed* page
    total_pages: number | null;
    domains_processed: number;
    total_domains: number | null;
    started_at: string;
    updated_at: string;
    completed_at?: string | null;
    is_active: boolean;
    error_message?: string | null;
}

// Configure for edge runtime
export const runtime = 'edge';
// Disable static generation to ensure fresh data on each request
export const dynamic = 'force-dynamic';

// --- Configuration for Resumable Scan ---
const PAGES_PER_RUN = 10; // Process up to 10 pages per execution. ADJUST AS NEEDED.
const PER_PAGE_API = 1000; // How many domains to request per page from Cloudflare (max 100 usually)
const TIMEOUT_BUFFER_SECONDS = 10; // Reduced buffer for potentially faster edge functions
// ---

// --- Helper Functions (LogData, cronLogger, updateScanProgress, initScanProgress, finalizeScan, processDomainPage) ---
type LogData = Record<string, unknown> | string | number | boolean | null | undefined;

async function cronLogger(message: string, data?: LogData, scanId?: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}]${scanId ? ` [Scan ${scanId}]` : ''} CRON SYNC: ${message}`;
    console.log(logMessage);
    // Avoid logging large objects unless necessary for debugging
    if (data !== undefined && data !== null) {
        // Limit size of logged objects
        const dataString = JSON.stringify(data, null, 2);
        if (dataString.length > 1000) {
            console.log(`Data: [Object too large, ${dataString.length} chars] Keys: ${Object.keys(data).join(', ')}`);
        } else {
            console.log(dataString);
        }
    }
}

async function updateScanProgress(
    supabase: SupabaseClient,
    progress: Partial<ScanProgress>,
    scanId: string
): Promise<boolean> {
    const updateStartTime = performance.now();
    try {
        const updatedFields = {
            ...progress,
            updated_at: new Date().toISOString(),
        };

        // Remove undefined fields to avoid overwriting with null in Supabase
        Object.keys(updatedFields).forEach(key => updatedFields[key as keyof typeof updatedFields] === undefined && delete updatedFields[key as keyof typeof updatedFields]);


        const { error } = await supabase
            .from('scan_progress')
            .update(updatedFields)
            .eq('scan_id', scanId);

        if (error) {
            await cronLogger('Error updating scan progress', { error: error.message, details: error.details, hint: error.hint, fields: Object.keys(updatedFields) }, scanId);
            return false;
        }
        // const durationMs = Math.round(performance.now() - updateStartTime);
        // console.log(`Scan progress updated: ${scanId}, Status: ${progress.status}, Page: ${progress.current_page}, Duration: ${durationMs}ms`); // Verbose success log
        return true;
    } catch (error) {
        const durationMs = Math.round(performance.now() - updateStartTime);
        await cronLogger('Exception updating scan progress', { error: error instanceof Error ? error.message : error, durationMs }, scanId);
        return false;
    }
}

async function initScanProgress(
    supabase: SupabaseClient,
    scanId: string,
    startPage: number, // The page number this run will START processing
    initialDomainsProcessed: number,
    initialTotalPages: number | null,
    initialTotalDomains: number | null
): Promise<boolean> {
     const initStartTime = performance.now();
    try {
        const timestamp = new Date().toISOString();
        const { error } = await supabase
            .from('scan_progress')
            .insert({
                scan_id: scanId,
                status: 'initializing',
                // If resuming (startPage > 1), current_page should reflect the *last completed* page
                current_page: startPage > 1 ? startPage - 1 : 0,
                total_pages: initialTotalPages,
                domains_processed: initialDomainsProcessed,
                total_domains: initialTotalDomains,
                started_at: timestamp,
                updated_at: timestamp,
                is_active: true, // Mark this new run as active
                completed_at: null,
                error_message: null
            });

        if (error) {
            // Handle potential race condition if a previous run wasn't marked inactive fast enough
            if (error.code === '23505') { // unique constraint violation
                 await cronLogger('Warning: Potential race condition or duplicate scan ID on init.', { scanId, error: error.message }, scanId);
                 // Allow proceeding, assuming finalizeScan will clean up later
                 return true;
            }
            await cronLogger('Error creating scan progress record', { error: error.message, code: error.code, details: error.details }, scanId);
            return false;
        }
         const durationMs = Math.round(performance.now() - initStartTime);
         await cronLogger('Initialized new scan progress tracking', { scanId, startPage, initialDomainsProcessed, durationMs }, scanId);
        return true;
    } catch (error) {
         const durationMs = Math.round(performance.now() - initStartTime);
        await cronLogger('Exception creating scan progress record', { error: error instanceof Error ? error.message : error, durationMs }, scanId);
        return false;
    }
}

async function finalizeScan(
    supabase: SupabaseClient,
    scanId: string, // The ID of the scan run being finalized
    status: 'completed' | 'failed' | 'processing', // 'processing' means paused
    finalDomainsProcessed: number,
    finalCurrentPage: number, // The last successfully processed page number
    totalPages: number | null,
    errorMessage?: string | null
) {
    const finalizeStartTime = performance.now();
    const timestamp = new Date().toISOString();
    const isCompleteOrFailed = status === 'completed' || status === 'failed';

    try {
        // Mark OTHER potentially stuck active scans as inactive first.
        // Do this carefully to avoid race conditions. Only mark older, active scans as failed.
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { error: updateOldError } = await supabase
            .from('scan_progress')
            .update({
                is_active: false,
                updated_at: timestamp,
                status: 'failed', // Mark older stuck scans as failed
                error_message: 'Scan superseded or timed out.'
            })
            .eq('is_active', true)
            .neq('scan_id', scanId) // Don't touch the current scan yet
            .lt('updated_at', fiveMinutesAgo); // Only affect scans not updated recently

        if (updateOldError) {
            await cronLogger('Warning: Failed to mark potentially stuck old active scans as inactive', { error: updateOldError.message }, scanId);
        }

        // Now, update the CURRENT scan's final status
        const success = await updateScanProgress(supabase, {
            status,
            domains_processed: finalDomainsProcessed,
            current_page: finalCurrentPage, // Save the last completed page
            total_pages: totalPages,
            is_active: !isCompleteOrFailed, // Keep active only if 'processing' (paused)
            completed_at: isCompleteOrFailed ? timestamp : null,
            error_message: errorMessage ?? null
        }, scanId);

        if (success) {
             const durationMs = Math.round(performance.now() - finalizeStartTime);
            await cronLogger(`Scan finalized with status: ${status}`, { scanId, finalCurrentPage, totalPages, finalDomainsProcessed, durationMs }, scanId);
        } else {
             await cronLogger(`Failed to finalize scan with status: ${status}`, { scanId }, scanId);
        }
    } catch (error) {
         const durationMs = Math.round(performance.now() - finalizeStartTime);
        await cronLogger('Exception finalizing scan', { error: error instanceof Error ? error.message : error, status, durationMs }, scanId);
    }
}

async function processDomainPage(
    supabase: SupabaseClient,
    domains: CloudflareDomain[], // Expecting domains WITHOUT redirect_url
    timestamp: string,
    scanId: string
): Promise<number> {
    const processStartTime = performance.now();
    if (!domains || !domains.length) return 0;

    // Map domain data for Supabase upsert, ensuring redirect_url is null
    const domainsForDB = domains.map((domain) => ({
        cloudflare_id: domain.id,
        name: domain.name,
        status: domain.status,
        paused: domain.paused,
        type: domain.type || 'unknown',
        created_on: domain.created_on,
        modified_on: domain.modified_on,
        last_synced: timestamp,
        redirect_url: null // Ensure this is null as it's not fetched here
    }));

    try {
        // Upsert domains into Supabase
        const { error } = await supabase
            .from('domains')
            .upsert(domainsForDB, {
                onConflict: 'cloudflare_id',
                ignoreDuplicates: false // Update existing records based on conflict
            });

        if (error) {
             await cronLogger('Supabase upsert error', { count: domains.length, error: error.message, code: error.code, details: error.details }, scanId);
            // Throw specific error to be caught by the main handler
            throw new Error(`Failed to upsert domains: ${error.message} (Code: ${error.code})`);
        }

        const durationMs = Math.round(performance.now() - processStartTime);
        // console.log(`Upserted ${domains.length} domains to Supabase. Duration: ${durationMs}ms`); // Verbose success log
        return domains.length;
    } catch (error) {
         const durationMs = Math.round(performance.now() - processStartTime);
         await cronLogger('Exception during domain upsert', { error: error instanceof Error ? error.message : error, durationMs }, scanId);
        throw error; // Re-throw
    }
}
// --- End Helper Functions ---


/**
 * Main handler for the GET request to trigger the Cloudflare domain sync cron job.
 * Optimized to fetch basic domain data quickly and handle resumability.
 */
export async function GET(request: Request) {
    const overallStartTime = performance.now();
    const currentRunScanId = uuidv4(); // Unique ID for this specific function execution

    // Basic logging first
    await cronLogger('CRON JOB TRIGGERED', { timestamp: new Date().toISOString(), scanId: currentRunScanId, url: request.url, method: request.method }, currentRunScanId);

    let supabase: SupabaseClient | null = null;
    let startPage = 1; // Page number to START processing in this run
    let domainsProcessed = 0; // Domains processed across all runs (if resuming)
    let totalPages: number | null = null;
    let totalDomains: number | null = null;
    let isResuming = false;
    let page1DataCache: { domains: CloudflareDomain[], resultInfo: ResultInfo } | null = null; // Cache for page 1 data

    // --- Vercel Automation Bypass Token ---
    const bypassToken = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const internalFetchHeaders: HeadersInit = {};
    if (bypassToken) {
        internalFetchHeaders['x-vercel-protection-bypass'] = bypassToken;
        internalFetchHeaders['x-vercel-skip-toolbar'] = '1'; // Skip Vercel toolbar injection
        console.log(`[${currentRunScanId}] Using Vercel bypass token header.`);
    } else {
        await cronLogger('Warning: VERCEL_AUTOMATION_BYPASS_SECRET not found. Internal API calls might fail if Vercel Protection is enabled.', {}, currentRunScanId);
    }
    // ---

    try {
        // --- Initialization and Authorization ---
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Supabase URL or Service Role Key missing in environment variables.');
        }
        supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Authorize the incoming request (from Vercel Cron or manual trigger)
        const validCronSecret = process.env.CRON_SECRET; // Use env var or fallback
        const userAgent = request.headers.get('user-agent') || '';
        const isVercelCron = userAgent.includes('vercel-cron');
        const authHeader = request.headers.get('Authorization');
        const url = new URL(request.url);
        const keyParam = url.searchParams.get('key');
        const hasValidToken = authHeader?.startsWith('Bearer ') && authHeader.substring(7) === validCronSecret;
        const hasValidKeyParam = keyParam === validCronSecret;
        const isDebugMode = url.searchParams.get('debug') === 'true'; // Allow debug runs
        const isSetupMode = url.searchParams.get('setup') === 'true'; // Allow setup runs

        if (!isVercelCron && !hasValidToken && !hasValidKeyParam && !isDebugMode && !isSetupMode) {
            await cronLogger('Unauthorized access attempt', { userAgent, url: request.url, hasAuthHeader: !!authHeader, hasKeyParam: !!keyParam }, currentRunScanId);
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        await cronLogger('Authorization successful', { isVercelCron, hasValidToken, hasValidKeyParam, isDebugMode, isSetupMode }, currentRunScanId);
        // --- End Initialization and Authorization ---

        // --- Check for Resumable Scan ---
        // Look for the most recently updated, still active, 'processing' scan
        const { data: lastScanData, error: lastScanError } = await supabase
            .from('scan_progress')
            .select('*')
            .eq('status', 'processing') // Look specifically for paused scans
            .eq('is_active', true)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (lastScanError) {
            await cronLogger('Error fetching last processing scan progress', { error: lastScanError.message }, currentRunScanId);
        } else if (lastScanData) {
            const lastScan = lastScanData as ScanProgress;
            // Ensure it has the necessary info to resume
            if (lastScan.total_pages !== null && lastScan.current_page < lastScan.total_pages) {
                startPage = lastScan.current_page + 1; // Start from the page AFTER the last completed one
                domainsProcessed = lastScan.domains_processed || 0;
                totalPages = lastScan.total_pages;
                totalDomains = lastScan.total_domains;
                isResuming = true;
                await cronLogger('Resuming previous scan', { resumeFromPage: startPage, initialDomainsProcessed: domainsProcessed, scanIdToResume: lastScan.scan_id }, currentRunScanId);
            } else {
                 await cronLogger('Found previous processing scan, but it cannot be resumed (already complete or missing totals). Starting fresh.', { lastScanId: lastScan.scan_id, status: lastScan.status, currentPage: lastScan.current_page, totalPages: lastScan.total_pages }, currentRunScanId);
            }
        } else {
            await cronLogger('No previous processing scan found, starting fresh.', {}, currentRunScanId);
        }
        // --- End Check for Resumable Scan ---

        // --- Initialize Progress for THIS Run ---
        // This creates the record that this specific execution will update.
        const progressInitialized = await initScanProgress(
            supabase,
            currentRunScanId,
            startPage,
            domainsProcessed,
            totalPages,
            totalDomains
        );
        if (!progressInitialized) {
            throw new Error('Failed to initialize scan progress tracking for current run.');
        }
        // --- End Initialize Progress ---

        // --- Setup Mode ---
        if (isSetupMode) {
             await cronLogger('Running in setup mode.', {}, currentRunScanId);
             // Add simplified setup logic here if needed
             // Example: Ensure tables exist (minimal check)
             try {
                 await supabase.from('domains').select('id', { count: 'exact', head: true });
                 await supabase.from('sync_history').select('id', { count: 'exact', head: true });
                 await supabase.from('scan_progress').select('id', { count: 'exact', head: true });
                 await cronLogger('Required tables appear to exist.', {}, currentRunScanId);
             } catch(tableError) {
                  await cronLogger('Error checking tables in setup mode', { error: tableError instanceof Error ? tableError.message : tableError }, currentRunScanId);
                  // Consider attempting creation or throwing error
             }
             await finalizeScan(supabase, currentRunScanId, 'completed', 0, 0, 0, 'Setup mode run');
             const durationMs = Math.round(performance.now() - overallStartTime);
             return NextResponse.json({ success: true, message: 'Setup mode completed.', scan_id: currentRunScanId, duration_ms: durationMs });
        }
        // --- End Setup Mode ---

        // --- Fetch Total Pages (if not resuming with known totals) ---
        const origin = new URL(request.url).origin;
        if (totalPages === null) {
            await updateScanProgress(supabase, { status: 'fetching' }, currentRunScanId);
            const page1Url = `${origin}/api/cloudflare/zone-management?page=1&per_page=${PER_PAGE_API}`;
            const fetchTotalsStart = performance.now();
            await cronLogger('Fetching page 1 to get pagination info', { apiUrl: page1Url }, currentRunScanId);

            const page1Response = await fetch(page1Url, { headers: internalFetchHeaders }); // Use bypass token
            const fetchTotalsDuration = Math.round(performance.now() - fetchTotalsStart);

            if (!page1Response.ok) {
                 const errorBody = await page1Response.text();
                 await cronLogger('Internal fetch for totals failed', { status: page1Response.status, statusText: page1Response.statusText, bodyPreview: errorBody.substring(0, 200), durationMs: fetchTotalsDuration }, currentRunScanId);
                throw new Error(`Failed to fetch page 1 for totals: HTTP ${page1Response.status}`);
            }

            const page1Json = await page1Response.json();
            if (!page1Json.success || !page1Json.resultInfo) {
                 await cronLogger('Internal fetch for totals returned invalid data', { success: page1Json.success, hasResultInfo: !!page1Json.resultInfo, error: page1Json.error, durationMs: fetchTotalsDuration }, currentRunScanId);
                throw new Error(`Invalid response from zone-management for page 1 totals: ${page1Json.error || 'Missing resultInfo'}`);
            }

            const resultInfo: ResultInfo = page1Json.resultInfo;
            totalPages = resultInfo.total_pages;
            totalDomains = resultInfo.total_count;
            page1DataCache = { domains: page1Json.domains || [], resultInfo }; // Cache page 1 data

            await cronLogger('Retrieved pagination info', { totalPages, totalDomains, durationMs: fetchTotalsDuration }, currentRunScanId);
            // Update the *current run's* record with the totals
            await updateScanProgress(supabase, { total_pages: totalPages, total_domains: totalDomains }, currentRunScanId);
        }
        // --- End Fetch Total Pages ---

        // --- Process Pages for This Run ---
        if (totalPages === 0) {
             await cronLogger('No domains found (total pages is 0). Completing scan.', {}, currentRunScanId);
             await finalizeScan(supabase, currentRunScanId, 'completed', 0, 0, 0); // Mark as completed with 0 pages/domains
             // Log to history as well
             const overallDurationMs = Math.round(performance.now() - overallStartTime);
             await supabase.from('sync_history').insert({ timestamp: new Date().toISOString(), domains_count: 0, success: true, duration_ms: overallDurationMs });
             return NextResponse.json({ success: true, message: 'No domains found to synchronize.', scan_id: currentRunScanId, status: 'completed', duration_ms: overallDurationMs });
        }


        await updateScanProgress(supabase, { status: 'processing' }, currentRunScanId);

        const endPageForThisRun = Math.min(startPage + PAGES_PER_RUN - 1, totalPages);
        await cronLogger(`Beginning domain sync loop for this run`, { startPage, endPageForThisRun, totalPages, pagesInThisRun: (endPageForThisRun - startPage + 1) }, currentRunScanId);

        let currentPage = startPage; // The page we are about to fetch/process
        let lastSuccessfullyProcessedPage = startPage - 1; // Track the last page fully completed

        for (; currentPage <= endPageForThisRun; currentPage++) {
            const loopIterationStart = performance.now();

            // Timeout Check (Edge Runtime specific - relies on Vercel terminating)
            // We add checks mainly for logging and graceful pause before forced termination.
             const elapsedSeconds = (performance.now() - overallStartTime) / 1000;
             // Determine rough timeout based on common Vercel plans
             let assumedTimeoutSeconds = 60; // Default Pro
             if (process.env.VERCEL_ENV === 'preview' || process.env.VERCEL_ENV === 'development') assumedTimeoutSeconds = 15; // Hobby/Preview/Dev
             // Note: process.env.VERCEL_PLAN is not typically available in Edge runtime.

             if (elapsedSeconds > assumedTimeoutSeconds - TIMEOUT_BUFFER_SECONDS) {
                 await cronLogger('Approaching function timeout limit, pausing execution.', { elapsedSeconds, assumedTimeoutSeconds }, currentRunScanId);
                 break; // Exit the loop prematurely
             }

            // Update progress *before* fetching page - indicates attempt
            // current_page still reflects the last *completed* page here
            // await updateScanProgress(supabase, { current_page: lastSuccessfullyProcessedPage }, currentRunScanId); // Optional: update before fetch

            let pageDomains: CloudflareDomain[] = [];
            const fetchPageStart = performance.now();

            try {
                // Use cached page 1 data if it's the first page of the run AND we have the cache
                if (currentPage === 1 && page1DataCache) {
                    await cronLogger(`Using cached data for page 1`, {}, currentRunScanId);
                    pageDomains = page1DataCache.domains;
                    page1DataCache = null; // Clear cache
                } else {
                    // Fetch data for the current page from the optimized endpoint
                    const pageUrl = `${origin}/api/cloudflare/zone-management?page=${currentPage}&per_page=${PER_PAGE_API}`;
                    // await cronLogger(`Fetching page ${currentPage}/${totalPages}`, { apiUrl: pageUrl }, currentRunScanId); // Less verbose log
                    const pageResponse = await fetch(pageUrl, { headers: internalFetchHeaders }); // Use bypass token

                    if (!pageResponse.ok) {
                        const errorBody = await pageResponse.text();
                        await cronLogger('Internal fetch failed for page', { page: currentPage, status: pageResponse.status, bodyPreview: errorBody.substring(0, 200) }, currentRunScanId);
                        throw new Error(`Failed to fetch domains on page ${currentPage}: HTTP ${pageResponse.status}`);
                    }
                    const pageData = await pageResponse.json();
                    if (!pageData.success) {
                        await cronLogger('Internal fetch returned success:false for page', { page: currentPage, error: pageData.error }, currentRunScanId);
                        throw new Error(`Failed to process page ${currentPage}: ${pageData.error || 'Unknown error from zone-management'}`);
                    }
                    pageDomains = pageData.domains || [];
                }
                const fetchPageDuration = Math.round(performance.now() - fetchPageStart);

                // Process (Upsert) the domains for the current page
                const processPageStart = performance.now();
                const domainsOnThisPage = await processDomainPage(supabase, pageDomains, new Date().toISOString(), currentRunScanId);
                domainsProcessed += domainsOnThisPage; // Increment total count
                lastSuccessfullyProcessedPage = currentPage; // Mark this page as successfully processed
                const processPageDuration = Math.round(performance.now() - processPageStart);

                // Update progress *after* successful processing of the page
                await updateScanProgress(supabase, {
                    domains_processed: domainsProcessed,
                    current_page: lastSuccessfullyProcessedPage // Update with the page number just completed
                }, currentRunScanId);

                const loopIterationDuration = Math.round(performance.now() - loopIterationStart);
                await cronLogger(`Processed page ${currentPage}/${totalPages}`, {
                    domainsOnPage: domainsOnThisPage,
                    totalProcessed: domainsProcessed,
                    progress: totalDomains ? `${Math.round((domainsProcessed / totalDomains) * 100)}%` : 'N/A',
                    fetchMs: fetchPageDuration,
                    processMs: processPageDuration,
                    loopMs: loopIterationDuration
                }, currentRunScanId);

            } catch (pageError) {
                await cronLogger(`Error processing page ${currentPage}. Stopping run.`, { error: pageError instanceof Error ? pageError.message : pageError }, currentRunScanId);
                // Re-throw to be caught by the main try-catch, which will mark the scan as failed
                throw pageError;
            }
        } // End of page processing loop

        // --- Finalize Run ---
        // 'lastSuccessfullyProcessedPage' holds the correct value here

        if (lastSuccessfullyProcessedPage >= totalPages) {
            // ---- All pages processed across all runs ----
            await cronLogger('All pages processed.', { totalPages, finalPageProcessed: lastSuccessfullyProcessedPage, totalDomainsProcessed: domainsProcessed }, currentRunScanId);

            // ---> Optional Cleanup Logic <---
            // Recommend a separate, less frequent job for cleanup based on 'last_synced' timestamp.
            await cronLogger('Skipping stale domain cleanup (recommend separate process)', {}, currentRunScanId);
            // ---> END Cleanup Logic <---

            // Mark THIS run scan as completed
            await finalizeScan(supabase, currentRunScanId, 'completed', domainsProcessed, lastSuccessfullyProcessedPage, totalPages);

            // Create a single sync history record for the completed multi-part scan
            const overallDurationMs = Math.round(performance.now() - overallStartTime);
            await cronLogger('Creating sync history record for completed scan', { timestamp: new Date().toISOString(), domainsCount: domainsProcessed, durationMs: overallDurationMs, scanId: currentRunScanId }, currentRunScanId);
            const { error: syncRecordError } = await supabase
                .from('sync_history')
                .insert({
                     timestamp: new Date().toISOString(),
                     domains_count: domainsProcessed,
                     success: true,
                     duration_ms: overallDurationMs,
                     // Optionally link to the final scan progress record ID if needed
                });
            if (syncRecordError) {
                await cronLogger('Failed to create sync history record', { error: syncRecordError.message, code: syncRecordError.code }, currentRunScanId);
            }

            await cronLogger(`Sync completed successfully`, { totalPages: totalPages, domainsProcessed: domainsProcessed, durationMs: overallDurationMs }, currentRunScanId);
            return NextResponse.json({
                success: true,
                message: `Synchronized ${domainsProcessed} domains from Cloudflare to Supabase (Completed).`,
                scan_id: currentRunScanId,
                status: 'completed',
                duration_ms: overallDurationMs,
                pages_processed_this_run: lastSuccessfullyProcessedPage - startPage + 1,
                total_pages: totalPages,
                total_domains: totalDomains
            });

        } else {
            // ---- Pausing execution for this run ----
            const nextPageToProcess = lastSuccessfullyProcessedPage + 1;
            await cronLogger('Reached page limit or timeout for this run, pausing.', { lastPageProcessed: lastSuccessfullyProcessedPage, nextPage: nextPageToProcess, totalPages }, currentRunScanId);
            // Mark scan as still processing, ready for the next run
            await finalizeScan(supabase, currentRunScanId, 'processing', domainsProcessed, lastSuccessfullyProcessedPage, totalPages);

            const overallDurationMs = Math.round(performance.now() - overallStartTime);
            await cronLogger(`Sync run paused successfully`, { durationMs: overallDurationMs, pagesProcessedThisRun: lastSuccessfullyProcessedPage - startPage + 1 }, currentRunScanId);

            // Don't add to sync_history until fully complete
            return NextResponse.json({
                success: true,
                message: `Synchronized domains up to page ${lastSuccessfullyProcessedPage}. Run paused, will resume next cycle from page ${nextPageToProcess}.`,
                scan_id: currentRunScanId,
                status: 'processing', // Indicate paused state
                duration_ms: overallDurationMs,
                pages_processed_this_run: lastSuccessfullyProcessedPage - startPage + 1,
                total_pages: totalPages,
                total_domains: totalDomains
            });
        }

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error during sync';
        await cronLogger('CRITICAL ERROR during sync', { error: message, stack: error instanceof Error ? error.stack : undefined }, currentRunScanId);
        const overallDurationMs = Math.round(performance.now() - overallStartTime);

        // Try to record the failed sync if supabase client was initialized
        if (supabase) {
            try {
                await cronLogger('Recording failed sync in database', {}, currentRunScanId);
                // Use finalizeScan to mark the current run as failed
                // Use startPage - 1 as the 'current_page' to indicate failure before/at startPage
                await finalizeScan(
                    supabase,
                    currentRunScanId,
                    'failed',
                    domainsProcessed, // Domains processed *before* the failure in this run
                    startPage - 1, // Page number before this run started
                    totalPages, // Record total pages if known
                    message // Record the error message
                );

                // Add to sync_history as failed (for this specific run attempt)
                 const { error: syncRecordError } = await supabase
                    .from('sync_history')
                    .insert({
                        timestamp: new Date().toISOString(),
                        domains_count: domainsProcessed, // Log domains processed before failure
                        success: false,
                        error_message: message,
                        duration_ms: overallDurationMs
                    });
                 if (syncRecordError) {
                     await cronLogger('Failed to create FAILED sync history record', { error: syncRecordError.message, code: syncRecordError.code }, currentRunScanId);
                 }

            } catch (dbError) {
                await cronLogger('Failed to record sync error in database', { dbError: dbError instanceof Error ? dbError.message : dbError }, currentRunScanId);
            }
        }

        // Return error response
        return NextResponse.json(
            { success: false, error: message, scan_id: currentRunScanId, status: 'failed', duration_ms: overallDurationMs },
            { status: 500 } // Internal Server Error
        );
    }
}
