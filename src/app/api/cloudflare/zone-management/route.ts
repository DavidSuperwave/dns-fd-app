import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// Set runtime configuration
export const dynamic = 'force-dynamic';

// API configuration
const CLOUDFLARE_API_URL = 'https://api.cloudflare.com/client/v4';
const CLOUDFLARE_API_TOKEN =  process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID; // Ensure this is set in your environment
const CLOUDFLARE_AUTH_EMAIL = 'dns@superwave.ai'; // Define the missing constant

// export async function GET(request: NextRequest) {
//   try {
//     const url = new URL(request.url);
//     const page = url.searchParams.get('page') || '1';
//     const perPage = url.searchParams.get('per_page') || '50';
//     // Use the standard /zones endpoint instead of the account-scoped one
//     const apiUrl = `${CLOUDFLARE_API_URL}/zones?page=${page}&per_page=${perPage}&status=active`;
    
//     console.log('[Zone Management] Fetching zones:', { apiUrl });
    
//     const response = await fetch(apiUrl, {
//       headers: {
//         'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
//         'Content-Type': 'application/json'
//       },
//       cache: 'no-store'
//     });

//     const data = await response.json();
//     console.log('[Zone Management] Cloudflare response:', {
//       success: data.success,
//       resultCount: data.result?.length || 0,
//       errors: data.errors,
//       messages: data.messages
//     });

//     if (!response.ok || !data.success) {
//       throw new Error(`Failed to fetch zones: ${data.errors?.[0]?.message || response.statusText}`);
//     }

//     const domains = data.result || [];
//     // console.log('[Zone Management] Found domains:', domains.map(d => d.name));

//     // Process domains in batches to avoid rate limits
//     const BATCH_SIZE = 5; // Process 5 domains at a time to stay under rate limit
//     const DELAY_BETWEEN_BATCHES = 2000; // Wait 2 seconds between batches

//     const domainsWithRedirects = [];
//     for (let i = 0; i < domains.length; i += BATCH_SIZE) {
//       const batch = domains.slice(i, i + BATCH_SIZE);
//       console.log(`[Zone Management] Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(domains.length/BATCH_SIZE)}`);

//       // Define types for Cloudflare Zone and Page Rule structures
//       interface CloudflareZone {
//         id: string;
//         name: string;
//         // Add other relevant zone properties if needed
//       }
//       interface PageRuleTarget {
//         target: string;
//         constraint: { operator: string; value: string };
//       }
//       interface PageRuleAction {
//         id: string;
//         value: {
//           url?: string;
//           target?: string;
//           status_code?: number;
//         } | string;
//       }
//       interface PageRule {
//         id: string;
//         targets: PageRuleTarget[];
//         actions: PageRuleAction[];
//         status: string;
//         priority: number;
//       }

//       // Process batch
//       const batchResults = await Promise.all(batch.map(async (domain: CloudflareZone & { redirect_url?: string }) => {
//         try {
//           const pageRulesUrl = `${CLOUDFLARE_API_URL}/zones/${domain.id}/pagerules`;
//           const pageRulesResponse = await fetch(pageRulesUrl, {
//             headers: {
//               'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
//               'Content-Type': 'application/json'
//             }
//           });

//           const pageRulesData = await pageRulesResponse.json();
          
//           console.log(`[Zone Management] Page rules for ${domain.name}:`, {
//             success: pageRulesData.success,
//             ruleCount: pageRulesData.result?.length || 0,
//             errors: pageRulesData.errors
//           });

//           if (!pageRulesResponse.ok || !pageRulesData.success) {
//             console.error(`[Zone Management] Failed to fetch page rules for ${domain.name}:`, pageRulesData.errors);
//             return domain;
//           }

//           // Find forwarding rules
//           const forwardingRule = pageRulesData.result?.find((rule: PageRule) => {
//             if (!Array.isArray(rule.actions)) return false;
//             return rule.actions.some((action: PageRuleAction) => {
//               if (action.id !== 'forwarding_url') return false;
//               const value = action.value;
//               const hasUrl = value && (
//                 (typeof value === 'string' && value.startsWith('http')) ||
//                 (typeof value === 'object' && value !== null && typeof value.url === 'string') ||
//                 (typeof value === 'object' && value !== null && typeof value.target === 'string')
//               );
//               return hasUrl;
//             });
//           });

//           if (forwardingRule) {
//             const action = forwardingRule.actions.find((a: PageRuleAction) => a.id === 'forwarding_url');
//             let redirectUrl: string | undefined;
//             if (action) { // Check if action exists
//                 const value = action.value;
//                 if (typeof value === 'string') {
//                   redirectUrl = value;
//                 } else if (typeof value === 'object' && value !== null && typeof value.url === 'string') {
//                   redirectUrl = value.url;
//                 } else if (typeof value === 'object' && value !== null && typeof value.target === 'string') {
//                   redirectUrl = value.target;
//                 }
//             }
//             console.log(`[Zone Management] Found redirect for ${domain.name}:`, redirectUrl);
//             return { ...domain, redirect_url: redirectUrl };
//           }

//           console.log(`[Zone Management] No redirect found for ${domain.name}`);
//           return domain;
//         } catch (error) {
//           console.error(`[Zone Management] Error fetching page rules for ${domain.name}:`, error);
//           return domain;
//         }
//       }));

//       domainsWithRedirects.push(...batchResults);

//       // Wait before processing next batch to avoid rate limits
//       if (i + BATCH_SIZE < domains.length) {
//         console.log(`[Zone Management] Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
//         await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
//       }
//     }
    
//     return NextResponse.json({
//       success: true,
//       domains: domainsWithRedirects,
//       resultInfo: data.result_info
//     });
//   } catch (error) {
//     return NextResponse.json({
//       success: false,
//       error: error instanceof Error ? error.message : 'Unknown error'
//     }, { status: 500 });
//   }
// }
/**
 * Fetches a single page of active Cloudflare zones.
 * OPTIMIZED VERSION: Only fetches the basic zone list.
 * Does NOT fetch individual page rules to avoid timeouts during bulk sync.
 */
export async function GET(request: NextRequest) {
  const startTime = performance.now();
  console.log('[Zone Management] Received GET request (Optimized)');

  // --- Optional: Authentication for Direct Access ---
  // If this endpoint could be called directly (not just by the cron job),
  // you might want to add authentication here, e.g., checking an internal secret header.
  // const internalSecret = request.headers.get('X-Internal-Secret');
  // if (internalSecret !== process.env.INTERNAL_API_SECRET) {
  //     console.warn('[Zone Management] Unauthorized direct access attempt.');
  //     return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  // }
  // ---

  try {
      // Validate Cloudflare API Token presence
      if (!CLOUDFLARE_API_TOKEN) {
          console.error('[Zone Management] CLOUDFLARE_API_TOKEN is not set.');
          throw new Error('Server configuration error: Cloudflare API token missing.');
      }

      const url = new URL(request.url);
      const page = url.searchParams.get('page') || '1';
      const perPage = url.searchParams.get('per_page') || '50'; // Default to 50, sync job uses 100

      // Use the standard /zones endpoint to list active zones
      const apiUrl = `${CLOUDFLARE_API_URL}/zones?page=${page}&per_page=${perPage}&status=active,pending&match=all`;

      console.log(`[Zone Management] Fetching zones from Cloudflare API: Page ${page}, PerPage ${perPage}`, { apiUrl });

      const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
              'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
              'Content-Type': 'application/json'
          },
          // Consider adding a timeout for the Cloudflare API call itself
          // signal: AbortSignal.timeout(10000), // Example: 10 second timeout (Requires Node 16+ or polyfill in Edge)
          cache: 'no-store' // Ensure fresh data from Cloudflare
      });

      const responseBodyText = await response.text(); // Read body once for reliable parsing/logging
      let data;
      try {
          data = JSON.parse(responseBodyText);
      } catch (parseError) {
          console.error('[Zone Management] Failed to parse Cloudflare JSON response:', { status: response.status, bodyPreview: responseBodyText.substring(0, 200) });
          throw new Error(`Failed to parse Cloudflare response (HTTP ${response.status})`);
      }

      console.log('[Zone Management] Cloudflare API response status:', response.status);
      console.log('[Zone Management] Cloudflare API response details:', {
          success: data.success,
          resultCount: data.result?.length ?? 0,
          hasErrors: data.errors && data.errors.length > 0,
          firstErrorCode: data.errors?.[0]?.code,
          firstErrorMessage: data.errors?.[0]?.message,
          resultInfo: data.result_info // Include pagination info
      });

      if (!response.ok) {
           console.error('[Zone Management] Cloudflare API request failed:', { status: response.status, errors: data.errors, messages: data.messages });
          const errorDetails = data.errors?.map((e: { code: number; message: string }) => `Code ${e.code}: ${e.message}`).join(', ') || `HTTP ${response.status}`;
          throw new Error(`Failed to fetch zones from Cloudflare: ${errorDetails}`);
      }

      if (!data.success) {
           console.warn('[Zone Management] Cloudflare API request succeeded (HTTP 200) but operation failed:', { errors: data.errors, messages: data.messages });
           const errorDetails = data.errors?.map((e: { code: number; message: string }) => `Code ${e.code}: ${e.message}`).join(', ') || 'Unknown Cloudflare error';
           throw new Error(`Cloudflare operation failed: ${errorDetails}`);
      }

      // Map to the expected structure, explicitly setting redirect_url to null
      const domains = data.result?.map((domain: any) => ({
          id: domain.id,
          name: domain.name,
          status: domain.status,
          paused: domain.paused,
          type: domain.type,
          created_on: domain.created_on,
          modified_on: domain.modified_on,
          redirect_url: null // Explicitly null - not fetched in this optimized version
      })) || [];

      const durationMs = Math.round(performance.now() - startTime);
      console.log(`[Zone Management] Successfully fetched page ${page}. Duration: ${durationMs}ms`);

      return NextResponse.json({
          success: true,
          domains: domains,
          resultInfo: data.result_info // Pass through pagination info
      });

  } catch (error) {
      const durationMs = Math.round(performance.now() - startTime);
      console.error('[Zone Management] Error in GET handler:', {
           errorMessage: error instanceof Error ? error.message : 'Unknown error',
           // stack: error instanceof Error ? error.stack : undefined, // Optional: log stack in dev
           durationMs
      });
      // Return a generic error to the client
      return NextResponse.json({
          success: false,
          error: 'An internal error occurred while fetching zone data.'
      }, { status: 500 }); // Internal Server Error
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, redirect_url } = body;
    
    if (!name || !redirect_url) {
      return NextResponse.json(
        { success: false, error: 'Both domain name and redirect URL are required' },
        { status: 400 }
      );
    }

    // Check if zone already exists using account-scoped GET (as this worked before)
    const existingZoneResponse = await fetch(`${CLOUDFLARE_API_URL}/accounts/${CLOUDFLARE_ACCOUNT_ID}/zones?name=${name}`, {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'X-Auth-Email': CLOUDFLARE_AUTH_EMAIL, // Add email header
        'Content-Type': 'application/json'
      }
    });

    const existingZoneData = await existingZoneResponse.json();

    if (existingZoneData.success && existingZoneData.result?.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'This domain already exists'
      }, { status: 400 });
    }

    // Create zone using the direct /zones endpoint (matching diagnostic script pattern)
    const zoneResponse = await fetch(`${CLOUDFLARE_API_URL}/zones`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`, // Keep Bearer
        'X-Auth-Email': CLOUDFLARE_AUTH_EMAIL, // Add email header
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        account: { id: CLOUDFLARE_ACCOUNT_ID }, // Still need account ID in body for POST /zones
        type: 'full'
      })
    });

    const zoneData = await zoneResponse.json();

    if (!zoneResponse.ok || !zoneData.success) {
      return NextResponse.json({
        success: false,
        error: zoneData?.errors?.[0]?.message || zoneResponse.statusText
      }, { status: zoneResponse.status || 500 });
    }

    // Create page rule for redirect (assuming this endpoint works with Bearer + Email)
    const pageRuleResponse = await fetch(`${CLOUDFLARE_API_URL}/zones/${zoneData.result.id}/pagerules`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`, // Keep Bearer
        'X-Auth-Email': CLOUDFLARE_AUTH_EMAIL, // Add email header
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        targets: [
          {
            target: 'url',
            constraint: {
              operator: 'matches',
              value: `*${name}/*`
            }
          }
        ],
        actions: [
          {
            id: 'forwarding_url',
            value: {
              url: redirect_url,
              status_code: 301
            }
          }
        ],
        status: 'active',
        priority: 1
      })
    });

    const pageRuleData = await pageRuleResponse.json();

    if (!pageRuleResponse.ok || !pageRuleData.success) {
      console.error('Failed to create page rule:', pageRuleData?.errors);
      // Don't fail the whole operation if page rule creation fails
    }

    // Return zone info with redirect
    const domain = {
      ...zoneData.result,
      redirect_url: redirect_url
    };

    return NextResponse.json({
      success: true,
      domain,
      nameservers: zoneData.result.name_servers || [],
      originalNameservers: zoneData.result.original_name_servers || []
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
