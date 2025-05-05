import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// --- Configuration ---
const DOMAINS_PER_RUN = 100;
const CONCURRENT_API_CALLS = 5;
const CHECK_THRESHOLD_HOURS = 24;
const TIMEOUT_BUFFER_SECONDS = 10;
const CLOUDFLARE_API_URL = 'https://api.cloudflare.com/client/v4';
// ---

// --- Interfaces ---
interface DomainToCheck {
    cloudflare_id: string; // Used as zone_id
    name: string; // For logging
}
interface PageRuleAction {
    id: string;
    value: { url?: string; target?: string; status_code?: number; } | string | null;
}
interface PageRule {
    id: string;
    targets: any[];
    actions: PageRuleAction[];
    status: string;
    priority: number;
}
// ---

// --- Helper Functions ---
type LogData = Record<string, unknown> | string | number | boolean | null | undefined;

async function redirectLogger(message: string, data?: LogData, runId?: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}]${runId ? ` [Run ${runId}]` : ''} REDIRECT SYNC: ${message}`;
    console.log(logMessage);
    if (data !== undefined && data !== null) {
        try {
            const dataString = JSON.stringify(data, null, 2);
            if (dataString.length > 1000) {
                console.log(`Data: [Object too large, ${dataString.length} chars] Keys: ${Object.keys(data).join(', ')}`);
            } else {
                console.log(dataString);
            }
        } catch (e) { console.log("Data: [Could not stringify]"); }
    }
}

async function logRunHistory(
    supabase: SupabaseClient,
    runId: string,
    status: 'started' | 'completed' | 'failed',
    details: {
        processed_count?: number;
        cloudflare_api_errors?: number;
        database_update_errors?: number;
        error_message?: string | null;
        duration_ms?: number;
    } = {}
) {
    try {
        if (status === 'started') {
            const { error } = await supabase
                .from('redirect_sync_history')
                .insert({
                    run_id: runId,
                    started_at: new Date().toISOString(),
                    status: 'started',
                    processed_count: 0,
                    cloudflare_api_errors: 0,
                    database_update_errors: 0,
                });
            if (error) {
                redirectLogger('Failed to insert initial history record', { runId, error: error.message }, runId);
            }
        } else {
            const updateData = {
                completed_at: new Date().toISOString(),
                status: status,
                processed_count: details.processed_count ?? 0,
                cloudflare_api_errors: details.cloudflare_api_errors ?? 0,
                database_update_errors: details.database_update_errors ?? 0,
                error_message: details.error_message ?? null,
                duration_ms: details.duration_ms ?? null,
            };
            const { error } = await supabase
                .from('redirect_sync_history')
                .update(updateData)
                .eq('run_id', runId);
            if (error) {
                 redirectLogger('Failed to update final history record', { runId, status, error: error.message }, runId);
            }
        }
    } catch (e) {
        redirectLogger('Exception logging run history', { runId, status, error: e instanceof Error ? e.message : e }, runId);
    }
}


async function fetchRedirectUrlForDomain(zoneId: string, domainName: string, runId: string): Promise<string | null> {
    const cfToken = process.env.CLOUDFLARE_API_TOKEN;
    if (!cfToken) {
        redirectLogger('Missing CLOUDFLARE_API_TOKEN env var', { domain: domainName }, runId);
        throw new Error('Server configuration error: Cloudflare token missing.');
    }
    const pageRulesUrl = `${CLOUDFLARE_API_URL}/zones/${zoneId}/pagerules`;
    const fetchStart = performance.now();
    try {
        const response = await fetch(pageRulesUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
            cache: 'no-store',
        });
        const durationMs = Math.round(performance.now() - fetchStart);
        if (!response.ok) {
            const errorText = await response.text();
            // Log but throw the error so the caller knows it failed
            redirectLogger('Cloudflare API error fetching page rules', { domain: domainName, zoneId, status: response.status, durationMs, error: errorText.substring(0, 200) }, runId);
            throw new Error(`CF API Error (${response.status}) for ${domainName}`);
        }
        const data = await response.json();
        if (!data.success) {
             // Log but treat as non-fatal (no redirect found)
             redirectLogger('Cloudflare API call succeeded but operation failed', { domain: domainName, zoneId, durationMs, errors: data.errors }, runId);
             return null;
        }
        const rules: PageRule[] = data.result || [];
        if (rules.length === 0) return null;

        const activeRules = rules.filter(rule => rule.status === 'active');
        activeRules.sort((a, b) => b.priority - a.priority); // Highest priority first

        for (const rule of activeRules) {
            const forwardAction = rule.actions.find(action => action.id === 'forwarding_url');
            if (forwardAction?.value) {
                let redirectUrl: string | undefined;
                if (typeof forwardAction.value === 'string') redirectUrl = forwardAction.value;
                else if (typeof forwardAction.value === 'object' && forwardAction.value !== null) redirectUrl = forwardAction.value.url || forwardAction.value.target;
                if (redirectUrl && redirectUrl.startsWith('http')) return redirectUrl; // Return first valid one
            }
        }
        return null; // No active forwarding rule found
    } catch (error) {
        // Log and re-throw so Promise.allSettled catches it
        const durationMs = Math.round(performance.now() - fetchStart);
        redirectLogger('Exception fetching page rules', { domain: domainName, zoneId, durationMs, error: error instanceof Error ? error.message : error }, runId);
        throw error;
    }
}

async function updateDomainsInSupabase(
    supabase: SupabaseClient,
    updates: Array<{ cloudflare_id: string; redirect_url: string | null; error?: boolean }>,
    runId: string
): Promise<{ successCount: number; errorCount: number }> {
    if (updates.length === 0) return { successCount: 0, errorCount: 0 };
    const updateStart = performance.now();
    const timestamp = new Date().toISOString();
    let successCount = 0;
    let errorCount = 0;

    const updatePromises = updates.map(async (update) => {
        try {
            const updateData: { redirect_url?: string | null; redirect_url_last_checked: string; last_synced: string } = {
                redirect_url_last_checked: timestamp,
                last_synced: timestamp
            };
            // Only set redirect_url if there wasn't an error during fetch for this domain
            if (!update.error) {
                updateData.redirect_url = update.redirect_url;
            }

            const { error } = await supabase
                .from('domains')
                .update(updateData)
                .eq('cloudflare_id', update.cloudflare_id);
            if (error) {
                redirectLogger('Supabase update error for domain', { cloudflare_id: update.cloudflare_id, error: error.message }, runId);
                return false;
            }
            return true;
        } catch (e) {
            redirectLogger('Exception during single domain update', { cloudflare_id: update.cloudflare_id, error: e instanceof Error ? e.message : e }, runId);
            return false;
        }
    });

    const results = await Promise.all(updatePromises);
    successCount = results.filter(Boolean).length;
    errorCount = results.length - successCount;
    const durationMs = Math.round(performance.now() - updateStart);
    redirectLogger(`Batch Supabase update complete`, { total: updates.length, success: successCount, errors: errorCount, durationMs }, runId);
    return { successCount, errorCount };
}
// --- End Helper Functions ---

// --- Main API Route Handler ---
export async function GET(request: Request) {
    const overallStartTime = performance.now();
    const runId = uuidv4();
    let supabase: SupabaseClient | null = null;
    let processedCount = 0;
    let apiErrorCount = 0;
    let dbErrorCount = 0;
    let criticalErrorMessage: string | null = null;

    try {
        // --- Initialization & Auth ---
        await redirectLogger('REDIRECT SYNC CRON JOB TRIGGERED', { runId, url: request.url }, runId);
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        if (!supabaseUrl || !supabaseServiceKey) throw new Error('Supabase URL or Service Role Key missing.');
        supabase = createClient(supabaseUrl, supabaseServiceKey);
        await redirectLogger('Supabase client initialized.', {}, runId);

        // Authorize request (same logic as main sync)
        const validCronSecret = process.env.CRON_SECRET;
        const userAgent = request.headers.get('user-agent') || '';
        const isVercelCron = userAgent.includes('vercel-cron');
        const authHeader = request.headers.get('Authorization');
        const url = new URL(request.url);
        const keyParam = url.searchParams.get('key');
        const hasValidToken = authHeader?.startsWith('Bearer ') && authHeader.substring(7) === validCronSecret;
        const hasValidKeyParam = keyParam === validCronSecret;
        const isDebugMode = url.searchParams.get('debug') === 'true';
        if (!isVercelCron && !hasValidToken && !hasValidKeyParam && !isDebugMode) {
            throw new Error('Unauthorized'); // Throw error early
        }
        await redirectLogger('Authorization successful', { isVercelCron, hasValidToken, hasValidKeyParam }, runId);
        // ---

        // --- Log Start to History Table ---
        await logRunHistory(supabase, runId, 'started');
        // ---

        // --- Fetch Batch of Domains to Check ---
        const checkThreshold = new Date();
        checkThreshold.setHours(checkThreshold.getHours() - CHECK_THRESHOLD_HOURS);
        const checkThresholdISO = checkThreshold.toISOString();
        await redirectLogger('Fetching batch of domains to check', { limit: DOMAINS_PER_RUN, threshold: checkThresholdISO }, runId);
        const fetchBatchStart = performance.now();

        const { data: domainsToCheck, error: selectError } = await supabase
            .from('domains')
            .select('cloudflare_id, name')
            .or(`redirect_url_last_checked.is.null,redirect_url_last_checked.lt.${checkThresholdISO}`)
            .order('cloudflare_id', { ascending: true })
            .limit(DOMAINS_PER_RUN);
        const fetchBatchDuration = Math.round(performance.now() - fetchBatchStart);

        if (selectError) throw new Error(`Failed to fetch domains to check: ${selectError.message}`);
        if (!domainsToCheck || domainsToCheck.length === 0) {
            await redirectLogger('No domains found requiring redirect check.', { durationMs: fetchBatchDuration }, runId);
            const overallDurationMs = Math.round(performance.now() - overallStartTime);
            await logRunHistory(supabase, runId, 'completed', { duration_ms: overallDurationMs }); // Log completion
            return NextResponse.json({ success: true, message: 'No domains needed redirect checking.', run_id: runId, processed_count: 0, duration_ms: overallDurationMs });
        }
        await redirectLogger(`Found ${domainsToCheck.length} domains to check.`, { durationMs: fetchBatchDuration }, runId);
        // ---

        // --- Process Domains ---
        const resultsToUpdate: Array<{ cloudflare_id: string; redirect_url: string | null; error?: boolean }> = [];
        const totalDomainsInBatch = domainsToCheck.length;

        for (let i = 0; i < totalDomainsInBatch; i += CONCURRENT_API_CALLS) {
            const batchStart = performance.now();
            const elapsedSeconds = (performance.now() - overallStartTime) / 1000;
            let assumedTimeoutSeconds = 60; // Default Pro
            if (process.env.VERCEL_ENV === 'preview' || process.env.VERCEL_ENV === 'development') assumedTimeoutSeconds = 15;
            if (elapsedSeconds > assumedTimeoutSeconds - TIMEOUT_BUFFER_SECONDS) {
                await redirectLogger('Approaching function timeout limit, stopping processing.', { processedCount, totalInBatch: totalDomainsInBatch, elapsedSeconds }, runId);
                break;
            }

            const currentBatch = domainsToCheck.slice(i, i + CONCURRENT_API_CALLS);

            // --- CORRECTED PROMISE HANDLING ---
            const batchPromises = currentBatch.map(async (domain) => {
                // Directly await the fetch function
                const url = await fetchRedirectUrlForDomain(domain.cloudflare_id, domain.name, runId);
                // Return data needed for update on success
                return { cloudflare_id: domain.cloudflare_id, redirect_url: url };
            });

            const settledResults = await Promise.allSettled(batchPromises);

            settledResults.forEach((result, index) => {
                const domain = currentBatch[index]; // Get the corresponding domain info
                if (result.status === 'fulfilled') {
                    // Success fetching page rule (or determined no redirect exists)
                    resultsToUpdate.push({
                        cloudflare_id: domain.cloudflare_id,
                        redirect_url: result.value.redirect_url, // The URL or null if no rule found
                        error: false // Indicate no fetch error occurred
                    });
                } else {
                    // Failure fetching page rule (fetchRedirectUrlForDomain threw an error)
                    apiErrorCount++; // Increment API error count
                    redirectLogger('Failed to fetch page rules for domain', { domain: domain.name, cloudflare_id: domain.cloudflare_id, reason: result.reason?.message ?? result.reason }, runId);
                    // Add a record indicating failure, so we still update 'redirect_url_last_checked'
                    resultsToUpdate.push({
                        cloudflare_id: domain.cloudflare_id,
                        redirect_url: null, // Set redirect to null on error
                        error: true // Indicate fetch error occurred
                    });
                }
            });
            // --- END OF CORRECTION ---

            processedCount += currentBatch.length;
            const batchDuration = Math.round(performance.now() - batchStart);
            // await redirectLogger(`Processed concurrent batch ${Math.floor(i / CONCURRENT_API_CALLS) + 1}`, { batchSize: currentBatch.length, processedSoFar: processedCount, durationMs: batchDuration }, runId); // Less verbose
        }
        await redirectLogger('Finished fetching Cloudflare data.', { fetchedCount: processedCount, apiErrors: apiErrorCount }, runId);
        // ---

        // --- Update Supabase ---
        if (resultsToUpdate.length > 0) {
            const { successCount, errorCount } = await updateDomainsInSupabase(supabase, resultsToUpdate, runId);
            dbErrorCount = errorCount;
        } else {
            await redirectLogger('No results to update in Supabase.', {}, runId);
        }
        // ---

        // --- Final Response & History Update ---
        const overallDurationMs = Math.round(performance.now() - overallStartTime);
        const finalMessage = `Run finished. Processed: ${processedCount}. CF API Errors: ${apiErrorCount}. DB Update Errors: ${dbErrorCount}.`;
        await redirectLogger(finalMessage, { durationMs: overallDurationMs }, runId);
        await logRunHistory(supabase, runId, 'completed', {
            processed_count: processedCount,
            cloudflare_api_errors: apiErrorCount,
            database_update_errors: dbErrorCount,
            duration_ms: overallDurationMs
        });
        return NextResponse.json({ success: true, message: finalMessage, run_id: runId, processed_count: processedCount, cloudflare_api_errors: apiErrorCount, database_update_errors: dbErrorCount, duration_ms: overallDurationMs });
        // ---

    } catch (error) {
        criticalErrorMessage = error instanceof Error ? error.message : 'Unknown error during redirect sync';
        await redirectLogger('CRITICAL ERROR during redirect sync', { error: criticalErrorMessage, stack: error instanceof Error ? error.stack : undefined }, runId);
        const overallDurationMs = Math.round(performance.now() - overallStartTime);

        // Attempt to log failure to history table if Supabase client exists
        if (supabase) {
            await logRunHistory(supabase, runId, 'failed', {
                processed_count: processedCount, // Log count attempted before failure
                cloudflare_api_errors: apiErrorCount,
                database_update_errors: dbErrorCount,
                error_message: criticalErrorMessage,
                duration_ms: overallDurationMs
            });
        }

        return NextResponse.json({ success: false, error: criticalErrorMessage, run_id: runId, processed_count: processedCount, duration_ms: overallDurationMs }, { status: 500 });
    }
}
