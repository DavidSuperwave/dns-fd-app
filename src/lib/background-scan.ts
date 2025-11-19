import { fetchDomains, fetchDnsRecords } from "./cloudflare-api";
import { createScanRecord, updateScanRecord, completeScanRecord, failScanRecord } from "./supabase-scan-service";
import { CloudflareDomain } from "./cloudflare-api";
import { createClient as createAdminClient } from '@supabase/supabase-js';

const DEBUG_PREFIX = '[Background Scan]'; // Define DEBUG_PREFIX earlier

// --- Server-Side Admin Client Initialization ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let localSupabaseAdmin: ReturnType<typeof createAdminClient> | null = null;

if (supabaseUrl && supabaseServiceKey) {
  localSupabaseAdmin = createAdminClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  console.log(`${DEBUG_PREFIX} Local Supabase admin client initialized.`);
} else {
  console.error(`${DEBUG_PREFIX} CRITICAL: Supabase URL or Service Key missing. Cannot initialize admin client.`);
  // Consider throwing an error if admin operations are absolutely required later
  // throw new Error("Missing Supabase credentials for background scan admin client.");
}

// Helper function to update domain redirects in Supabase
async function updateDomainRedirects(domains: CloudflareDomain[]) {
  try {
    console.log(`${DEBUG_PREFIX} Updating domain redirects in Supabase`);

    // Get all cloudflare_ids from the current scan
    const currentIds = domains.map(domain => domain.id);

    // --- Delete old domains ---
    if (!localSupabaseAdmin) {
      console.error(`${DEBUG_PREFIX} Admin client not available. Skipping deletion of old domains.`);
    } else if (currentIds.length > 0) { // Only delete if there are current IDs to compare against
      console.log(`${DEBUG_PREFIX} Deleting domains from DB not present in the latest Cloudflare scan.`);
      const { error: deleteError } = await localSupabaseAdmin
        .from('domains')
        .delete()
        // Ensure IDs are properly quoted if they are strings (like UUIDs or Cloudflare IDs)
        .not('cloudflare_id', 'in', `(${currentIds.map(id => `'${id}'`).join(',')})`);

      if (deleteError) {
        console.error(`${DEBUG_PREFIX} Error deleting old domains:`, deleteError);
        // Decide how to handle - maybe log and continue?
      } else {
        console.log(`${DEBUG_PREFIX} Successfully deleted old domains.`);
      }
    } else {
      console.log(`${DEBUG_PREFIX} No current domains found in scan batch. Skipping deletion.`);
    }

    // Update remaining domains (prepare data)
    const updates = domains.map(domain => ({
      cloudflare_id: domain.id,
      name: domain.name,
      status: domain.status,
      paused: domain.paused,
      type: domain.type,
      created_on: domain.created_on,
      modified_on: domain.modified_on,
      redirect_url: domain.redirect_url
    }));

    // --- Upsert current domains ---
    if (!localSupabaseAdmin) {
      console.error(`${DEBUG_PREFIX} Admin client not available. Skipping upsert of domain data.`);
    } else if (updates.length > 0) {
      console.log(`${DEBUG_PREFIX} Upserting ${updates.length} domains into DB.`);
      const { error: upsertError } = await localSupabaseAdmin
        .from('domains')
        .upsert(updates as any, {
          onConflict: 'cloudflare_id' // Assumes 'cloudflare_id' is the unique constraint column
        });

      if (upsertError) {
        console.error(`${DEBUG_PREFIX} Error upserting domain data:`, upsertError);
        // Decide how to handle - maybe log and continue?
      } else {
        console.log(`${DEBUG_PREFIX} Successfully upserted ${updates.length} domains.`);
      }
    } else {
      console.log(`${DEBUG_PREFIX} No domains in current batch to upsert.`);
    }

    // Adjust final log message
    console.log(`${DEBUG_PREFIX} Finished syncing batch of ${domains.length} domains.`);
  } catch (error) { // This catch block corresponds to the try block starting at line 10
    console.error(`${DEBUG_PREFIX} Failed to update domain redirects:`, error);
    throw error;
  }
}

interface ScanProgress {
  current: number;
  total: number;
  percentage: number;
  startTime: number;
}

interface ScanStatusBreakdown {
  active: number;
  pending: number;
  moved: number;
  deactivated: number;
  initializing: number;
  read_only: number;
  [key: string]: number;
}

interface ScanResult {
  totalDomains: number;
  nonActiveDomains: CloudflareDomain[];
  statusBreakdown: ScanStatusBreakdown;
  startTime: string;
  endTime: string;
  totalPages: number;
}

// DEBUG_PREFIX moved higher up

// Perform a background scan of all Cloudflare domains
export async function performBackgroundScan(perPage: number = 50): Promise<ScanResult | null> {
  console.log(`${DEBUG_PREFIX} Starting scan with ${perPage} items per page`);

  let scanId: string | null = null;
  const startTime = new Date().toISOString();

  try {
    const statusBreakdown: ScanStatusBreakdown = {
      active: 0,
      pending: 0,
      moved: 0,
      deactivated: 0,
      initializing: 0,
      read_only: 0
    };

    const nonActiveDomains: CloudflareDomain[] = [];
    let totalPages = 1;
    let totalDomains = 0;

    // Initialize progress
    let progress: ScanProgress = {
      current: 0,
      total: 0,
      percentage: 0,
      startTime: Date.now()
    };

    console.log(`${DEBUG_PREFIX} Fetching first page to get total count`);

    // First request to get the total pages
    const firstResult = await fetchDomains(1, perPage);

    if (!firstResult.success) {
      throw new Error("Failed to fetch domains from Cloudflare API");
    }

    // Process first batch
    totalDomains += firstResult.domains?.length || 0;
    totalPages = firstResult.resultInfo.total_pages || 1;

    console.log(`${DEBUG_PREFIX} Initial scan info:`, {
      totalDomains,
      totalPages,
      firstPageDomains: firstResult.domains?.length
    });

    // Update progress
    progress = {
      current: 1,
      total: totalPages,
      percentage: Math.round((1 / totalPages) * 100),
      startTime: Date.now()
    };

    // Process domains from first page
    console.log(`${DEBUG_PREFIX} Processing domains from first page`);
    const domains: CloudflareDomain[] = firstResult.domains || [];
    const domainIds = domains.map(domain => domain.id);

    console.log(`${DEBUG_PREFIX} Fetching DNS records for ${domainIds.length} domains`);
    const dnsRecordsMap = await Promise.all(domainIds.map(async id => {
      const result = await fetchDnsRecords(id);
      return { id, records: result.success ? result.dnsRecords : [] };
    }));

    // Convert DNS records array to map for easier lookup
    const dnsRecords = Object.fromEntries(
      dnsRecordsMap.map(({ id, records }) => [id, records])
    );

    domains.forEach((domain: CloudflareDomain) => {
      const status = domain.paused ? 'paused' : (domain.status || 'unknown').toLowerCase();
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;

      // Add DNS records information to domain
      domain.dns_records = dnsRecords[domain.id] || [];

      if (domain.status !== 'active' || domain.paused === true) {
        nonActiveDomains.push(domain);
      }
    });

    // Update domain redirects in Supabase
    await updateDomainRedirects(domains);

    // Create initial scan record
    console.log(`${DEBUG_PREFIX} Creating scan record`);
    scanId = await createScanRecord();
    if (!scanId) {
      throw new Error("Failed to create scan record");
    }

    // Update scan record with initial progress
    console.log(`${DEBUG_PREFIX} Updating initial progress`);
    await updateScanRecord(scanId, progress, {
      totalDomains,
      statusBreakdown,
      nonActiveDomains,
      startTime,
      endTime: "",
      totalPages
    });

    // Process remaining pages
    if (totalPages > 1) {
      console.log(`${DEBUG_PREFIX} Processing remaining ${totalPages - 1} pages`);

      for (let page = 2; page <= totalPages; page++) {
        try {
          console.log(`${DEBUG_PREFIX} Fetching page ${page}/${totalPages}`);
          const result = await fetchDomains(page, perPage);

          if (result.success && result.domains) {
            // Update total domains count
            totalDomains += result.domains.length;

            // Process domains and fetch DNS records
            const domains: CloudflareDomain[] = result.domains || [];
            const domainIds = domains.map(domain => domain.id);

            console.log(`${DEBUG_PREFIX} Fetching DNS records for ${domainIds.length} domains`);
            const dnsRecordsMap = await Promise.all(domainIds.map(async id => {
              const result = await fetchDnsRecords(id);
              return { id, records: result.success ? result.dnsRecords : [] };
            }));

            // Convert DNS records array to map for easier lookup
            const dnsRecords = Object.fromEntries(
              dnsRecordsMap.map(({ id, records }) => [id, records])
            );

            domains.forEach((domain: CloudflareDomain) => {
              const status = domain.paused ? 'paused' : (domain.status || 'unknown').toLowerCase();
              statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;

              // Add DNS records information to domain
              domain.dns_records = dnsRecords[domain.id] || [];

              if (domain.status !== 'active' || domain.paused === true) {
                nonActiveDomains.push(domain);
              }
            });

            // Update domain redirects in Supabase
            await updateDomainRedirects(domains);

            // Update progress
            progress = {
              current: page,
              total: totalPages,
              percentage: Math.round((page / totalPages) * 100),
              startTime: progress.startTime
            };

            // Update scan record
            await updateScanRecord(scanId, progress, {
              totalDomains,
              statusBreakdown,
              nonActiveDomains,
              startTime,
              endTime: "",
              totalPages
            });

            console.log(`${DEBUG_PREFIX} Processed page ${page}/${totalPages}`, {
              currentPage: page,
              newDomains: result.domains.length,
              nonActiveDomains: nonActiveDomains.length,
              progress: progress.percentage
            });
          } else {
            console.error(`${DEBUG_PREFIX} Failed to fetch page ${page}:`, result);
          }
        } catch (pageError) {
          console.error(`${DEBUG_PREFIX} Error fetching page ${page}:`, pageError);
          // Continue with next page despite error
        }
      }
    }

    // Create final result
    const endTime = new Date().toISOString();
    const result: ScanResult = {
      totalDomains,
      nonActiveDomains,
      statusBreakdown,
      startTime,
      endTime,
      totalPages
    };

    // Mark scan as complete
    console.log(`${DEBUG_PREFIX} Completing scan`, {
      totalDomains,
      nonActiveDomains: nonActiveDomains.length,
      duration: new Date(endTime).getTime() - new Date(startTime).getTime()
    });

    await completeScanRecord(scanId, result);

    console.log(`${DEBUG_PREFIX} Scan completed successfully`);

    return result;
  } catch (error) {
    console.error(`${DEBUG_PREFIX} Error during scan:`, error);

    if (scanId) {
      await failScanRecord(
        scanId,
        error instanceof Error ? error.message : 'Unknown error during scan'
      );
    }

    return null;
  }
}