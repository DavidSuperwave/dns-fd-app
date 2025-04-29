import { NextResponse } from 'next/server';

// Cloudflare authentication credentials - using hardcoded values for consistency
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

// Cloudflare API base URL
const CLOUDFLARE_API_URL = 'https://api.cloudflare.com/client/v4';

// Helper function to get authentication headers using Bearer token auth
const getAuthHeaders = (): HeadersInit => {
  if (!CLOUDFLARE_API_TOKEN) {
    throw new Error('[Cloudflare Redirects API] CLOUDFLARE_API_TOKEN is not defined');
  }

  // Use API Token authentication with Bearer format
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN.trim()}`
  };
  
  return headers;
};

// Mock redirect data for testing
const mockRedirects: Record<string, string | null> = {
  'mock-domain-1': 'https://example.com',
  'mock-domain-2': 'https://target-site.com',
  'mock-domain-3': null,
  'mock-domain-4': 'https://redirect-example.org',
};

/**
 * Check if a domain has redirects by examining DNS records and page rules
 */
async function checkDomainRedirect(zoneId: string): Promise<string | null> {
  try {
    // First, check for Page Rules that might redirect the domain
    const pageRulesResponse = await fetch(
      `${CLOUDFLARE_API_URL}/zones/${zoneId}/pagerules`,
      {
        method: 'GET',
        headers: getAuthHeaders()
      }
    );
    
    if (pageRulesResponse.ok) {
      // Define types for Page Rule structure (can be shared or imported if used elsewhere)
      interface PageRuleTarget {
        target: string;
        constraint: { operator: string; value: string };
      }
      interface PageRuleAction {
        id: string;
        value: {
          url?: string;
          target?: string;
        } | string;
      }
      interface PageRule {
        id: string;
        targets: PageRuleTarget[];
        actions: PageRuleAction[];
        status: string;
        priority: number;
      }
      interface PageRulesResponse {
        success: boolean;
        result: PageRule[];
        errors: Array<{
          code: number;
          message: string;
        }>;
        messages: string[];
      }

      const pageRulesData: PageRulesResponse = await pageRulesResponse.json();

      if (pageRulesData.success && Array.isArray(pageRulesData.result) && pageRulesData.result.length > 0) {
        // Check if any page rules are forwarding rules
        const forwardingRules = pageRulesData.result.filter((rule: PageRule) => { // Use PageRule type
          if (!Array.isArray(rule.actions)) return false;

          // Look for forwarding actions in the rule
          return rule.actions.some((action: PageRuleAction) => // Use PageRuleAction type
            action.id === 'forwarding_url' &&
            action.value &&
            typeof action.value === 'object' && // Ensure value is an object
            typeof action.value.url === 'string' // Check for the url property
          );
        });
        
        if (forwardingRules.length > 0) {
          // Get the URL from the first forwarding rule
          const redirectAction = forwardingRules[0].actions.find(
            (action: PageRuleAction) => action.id === 'forwarding_url' // Use PageRuleAction type
          );

          // Safely access the URL
          if (redirectAction && typeof redirectAction.value === 'object' && redirectAction.value !== null && typeof redirectAction.value.url === 'string') {
            return redirectAction.value.url;
          }
        }
      }
    }
    
    // If no page rules with redirects, check DNS records
    const dnsResponse = await fetch(
      `${CLOUDFLARE_API_URL}/zones/${zoneId}/dns_records?type=CNAME`,
      {
        method: 'GET',
        headers: getAuthHeaders()
      }
    );
    
    if (dnsResponse.ok) {
      // Define types for DNS Record and Response
       interface DnsRecord {
        id: string;
        type: string;
        name: string;
        content: string;
        zone_name: string;
        // Add other relevant fields if needed
      }
      interface DnsResponse {
        success: boolean;
        result: DnsRecord[];
        errors: Array<{
          code: number;
          message: string;
        }>;
        messages: string[];
      }

      const dnsData: DnsResponse = await dnsResponse.json();

      if (dnsData.success && Array.isArray(dnsData.result) && dnsData.result.length > 0) {
        // Check for root CNAME records which would indicate a redirect
        const rootCnames = dnsData.result.filter((record: DnsRecord) => // Use DnsRecord type
          (record.type === 'CNAME' && (record.name === '@' || record.name === record.zone_name)) // Compare with actual zone_name
        );
        
        if (rootCnames.length > 0) {
          return `https://${rootCnames[0].content}`;
        }
      }
    }
    
    // No redirect found
    return null;
  } catch (error) {
    console.error(`[Cloudflare Redirects API] Error checking redirect for ${zoneId}:`, error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json();
    const { domainIds } = body;
    
    if (!domainIds || !Array.isArray(domainIds) || domainIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Domain IDs array is required' },
        { status: 400 }
      );
    }
    
    console.log(`[Cloudflare Redirects API] Fetching redirects for ${domainIds.length} domains`);
    
    // Response object to build
    const redirects: Record<string, string | null> = {};
    
    // For each domain ID, fetch redirect information
    // Process in batches to avoid overwhelming the API
    const batchSize = 5;
    const mockDomainPrefix = 'mock-domain';
    
    // Process in batches
    for (let i = 0; i < domainIds.length; i += batchSize) {
      const batch = domainIds.slice(i, i + batchSize);
      const batchPromises = batch.map(async (domainId: string) => {
        try {
          // For testing - use mock data if ID has mock prefix
          if (domainId.startsWith(mockDomainPrefix)) {
            redirects[domainId] = mockRedirects[domainId] || null;
            return;
          }
          
          // Otherwise fetch real data
          const redirectUrl = await checkDomainRedirect(domainId);
          redirects[domainId] = redirectUrl;
        } catch (error) {
          console.error(`[Cloudflare Redirects API] Error processing domain ${domainId}:`, error);
          redirects[domainId] = null;
        }
      });
      
      // Wait for batch to complete
      await Promise.all(batchPromises);
    }
    
    console.log(`[Cloudflare Redirects API] Successfully fetched ${Object.keys(redirects).length} redirects`);
    
    return NextResponse.json({
      success: true,
      redirects
    });
  } catch (error) {
    console.error('[Cloudflare Redirects API] Failed to process bulk request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}