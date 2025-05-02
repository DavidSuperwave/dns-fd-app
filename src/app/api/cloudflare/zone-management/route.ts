import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// Set runtime configuration
export const dynamic = 'force-dynamic';

// API configuration
const CLOUDFLARE_API_URL = 'https://api.cloudflare.com/client/v4';
const CLOUDFLARE_API_TOKEN =  process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID; // Ensure this is set in your environment
const CLOUDFLARE_AUTH_EMAIL = 'dns@superwave.ai'; // Define the missing constant

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    const perPage = url.searchParams.get('per_page') || '50';
    await cronLogger(
      'Cloudflare token presence check',
      {
        present: !!process.env.CLOUDFLARE_API_TOKEN,
        length: process.env.CLOUDFLARE_API_TOKEN?.length ?? 0,
      }
    );
    // Use the standard /zones endpoint instead of the account-scoped one
    const apiUrl = `${CLOUDFLARE_API_URL}/zones?page=${page}&per_page=${perPage}&status=active`;
    
    console.log('[Zone Management] Fetching zones:', { apiUrl });
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    });

    const data = await response.json();
    console.log('[Zone Management] Cloudflare response:', {
      success: data.success,
      resultCount: data.result?.length || 0,
      errors: data.errors,
      messages: data.messages
    });

    if (!response.ok || !data.success) {
      throw new Error(`Failed to fetch zones: ${data.errors?.[0]?.message || response.statusText}`);
    }

    const domains = data.result || [];
    // console.log('[Zone Management] Found domains:', domains.map(d => d.name));

    // Process domains in batches to avoid rate limits
    const BATCH_SIZE = 5; // Process 5 domains at a time to stay under rate limit
    const DELAY_BETWEEN_BATCHES = 2000; // Wait 2 seconds between batches

    const domainsWithRedirects = [];
    for (let i = 0; i < domains.length; i += BATCH_SIZE) {
      const batch = domains.slice(i, i + BATCH_SIZE);
      console.log(`[Zone Management] Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(domains.length/BATCH_SIZE)}`);

      // Define types for Cloudflare Zone and Page Rule structures
      interface CloudflareZone {
        id: string;
        name: string;
        // Add other relevant zone properties if needed
      }
      interface PageRuleTarget {
        target: string;
        constraint: { operator: string; value: string };
      }
      interface PageRuleAction {
        id: string;
        value: {
          url?: string;
          target?: string;
          status_code?: number;
        } | string;
      }
      interface PageRule {
        id: string;
        targets: PageRuleTarget[];
        actions: PageRuleAction[];
        status: string;
        priority: number;
      }

      // Process batch
      const batchResults = await Promise.all(batch.map(async (domain: CloudflareZone & { redirect_url?: string }) => {
        try {
          const pageRulesUrl = `${CLOUDFLARE_API_URL}/zones/${domain.id}/pagerules`;
          const pageRulesResponse = await fetch(pageRulesUrl, {
            headers: {
              'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
              'Content-Type': 'application/json'
            }
          });

          const pageRulesData = await pageRulesResponse.json();
          
          console.log(`[Zone Management] Page rules for ${domain.name}:`, {
            success: pageRulesData.success,
            ruleCount: pageRulesData.result?.length || 0,
            errors: pageRulesData.errors
          });

          if (!pageRulesResponse.ok || !pageRulesData.success) {
            console.error(`[Zone Management] Failed to fetch page rules for ${domain.name}:`, pageRulesData.errors);
            return domain;
          }

          // Find forwarding rules
          const forwardingRule = pageRulesData.result?.find((rule: PageRule) => {
            if (!Array.isArray(rule.actions)) return false;
            return rule.actions.some((action: PageRuleAction) => {
              if (action.id !== 'forwarding_url') return false;
              const value = action.value;
              const hasUrl = value && (
                (typeof value === 'string' && value.startsWith('http')) ||
                (typeof value === 'object' && value !== null && typeof value.url === 'string') ||
                (typeof value === 'object' && value !== null && typeof value.target === 'string')
              );
              return hasUrl;
            });
          });

          if (forwardingRule) {
            const action = forwardingRule.actions.find((a: PageRuleAction) => a.id === 'forwarding_url');
            let redirectUrl: string | undefined;
            if (action) { // Check if action exists
                const value = action.value;
                if (typeof value === 'string') {
                  redirectUrl = value;
                } else if (typeof value === 'object' && value !== null && typeof value.url === 'string') {
                  redirectUrl = value.url;
                } else if (typeof value === 'object' && value !== null && typeof value.target === 'string') {
                  redirectUrl = value.target;
                }
            }
            console.log(`[Zone Management] Found redirect for ${domain.name}:`, redirectUrl);
            return { ...domain, redirect_url: redirectUrl };
          }

          console.log(`[Zone Management] No redirect found for ${domain.name}`);
          return domain;
        } catch (error) {
          console.error(`[Zone Management] Error fetching page rules for ${domain.name}:`, error);
          return domain;
        }
      }));

      domainsWithRedirects.push(...batchResults);

      // Wait before processing next batch to avoid rate limits
      if (i + BATCH_SIZE < domains.length) {
        console.log(`[Zone Management] Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }
    
    return NextResponse.json({
      success: true,
      domains: domainsWithRedirects,
      resultInfo: data.result_info
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
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
