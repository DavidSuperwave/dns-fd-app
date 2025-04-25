import { NextResponse, NextRequest } from 'next/server';

// Cloudflare authentication credentials - using hardcoded values for consistency
const CLOUDFLARE_API_TOKEN = '3zYP5-L3oxluS5N3VNJNH7UXxh9NbxbyU0psh8uG';

// Log that we're using hardcoded values
console.log('[Cloudflare Redirects API] Using hardcoded API Token for consistency');

// Cloudflare API base URL
const CLOUDFLARE_API_URL = 'https://api.cloudflare.com/client/v4';

// Helper function to get authentication headers using Bearer token auth
const getAuthHeaders = (): HeadersInit => {
  // Use API Token authentication with Bearer format
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN.trim()}`
  };
  
  return headers;
};

// Helper function to log API responses for debugging
const logApiResponse = async (response: Response, context: string) => {
  try {
    // Clone the response so we can read the body without consuming it
    const clonedResponse = response.clone();
    const data = await clonedResponse.json();
    
    // For debugging log the complete raw response
    console.log(`[Cloudflare Redirects API ${context}]`, {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: data
    });
    
    return data;
  } catch (error) {
    console.error(`[Cloudflare Redirects API ${context}] Failed to log response:`, error);
    return null;
  }
};

// Mock redirect data for testing
const mockRedirects: Record<string, string | null> = {
  'mock-domain-1': 'https://example.com',
  'mock-domain-2': 'https://target-site.com',
  'mock-domain-3': null,
};

export async function GET(
  request: NextRequest, // Use NextRequest
  context // Remove type annotation
) {
  try {
    const zoneId = context.params.id; // Access id via context.params
    
    console.log(`[Cloudflare Redirects API] Fetching redirect info for zone: ${zoneId}`);
    
    if (!zoneId) {
      return NextResponse.json(
        { success: false, error: 'Zone ID is required' },
        { status: 400 }
      );
    }
    
    // For testing - check if we're using a mock ID
    if (zoneId.startsWith('mock-domain')) {
      console.log('[Cloudflare Redirects API] Using mock data for testing');
      return NextResponse.json({
        success: true,
        redirectUrl: mockRedirects[zoneId] || null
      });
    }
    
    // Real implementation - fetch DNS records to check for redirects
    // First, we'll check for Page Rules that might redirect the domain
    try {
      console.log(`[Cloudflare Redirects API] Checking page rules for zone ${zoneId}`);
      
      const pageRulesResponse = await fetch(
        `${CLOUDFLARE_API_URL}/zones/${zoneId}/pagerules`,
        {
          method: 'GET',
          headers: getAuthHeaders()
        }
      );
      
      // Log the response for debugging
      const pageRulesData = await logApiResponse(pageRulesResponse, 'GET page rules');
      
      if (!pageRulesResponse.ok) {
        console.error(`[Cloudflare Redirects API] Failed to fetch page rules: ${pageRulesResponse.status} ${pageRulesResponse.statusText}`);
        throw new Error(`Failed to fetch page rules: ${pageRulesResponse.status}`);
      }
      
      if (!pageRulesData.success) {
        console.error(`[Cloudflare Redirects API] Cloudflare API error:`, pageRulesData.errors);
        throw new Error(`Cloudflare API error: ${pageRulesData.errors?.[0]?.message || 'Unknown error'}`);
      }
      
      // Define types for Page Rule structure
      interface PageRuleTarget {
        target: string;
        constraint: { operator: string; value: string };
      }
      interface PageRuleAction {
        id: string;
        value: {
          url?: string;
          target?: string;
        } | string; // Value can be either a string or an object with url/target
      }
      interface PageRule {
        id: string;
        targets: PageRuleTarget[];
        actions: PageRuleAction[];
        status: string;
        priority: number;
        modified_on: string;
        created_on: string;
      }

      // Log all page rules for debugging
      console.log(`[Cloudflare Redirects API] Found ${pageRulesData.result.length} page rules:`,
        pageRulesData.result.map((rule: PageRule) => ({
          id: rule.id,
          targets: rule.targets,
          actions: rule.actions.map(action => ({
            id: action.id,
            value: typeof action.value === 'string' ? action.value :
              action.value?.url || action.value?.target || null
          })),
          status: rule.status,
          priority: rule.priority
        }))
      );
      
      if (pageRulesResponse.ok && pageRulesData.success && Array.isArray(pageRulesData.result)) {
        // Check if any page rules are forwarding rules
        const forwardingRules = pageRulesData.result.filter((rule: PageRule) => { // Use PageRule type
          if (!Array.isArray(rule.actions)) return false;

          // Look for forwarding actions in the rule
          return rule.actions.some((action: PageRuleAction) => { // Use PageRuleAction type
            if (action.id !== 'forwarding_url') return false;

            // Check for both old and new forwarding URL formats
            const value = action.value; // Assign to variable for easier access
            const hasUrl = value && (
              (typeof value === 'string' && value.startsWith('http')) ||
              (typeof value === 'object' && value !== null && typeof value.url === 'string') || // Check value.url
              (typeof value === 'object' && value !== null && typeof value.target === 'string') // Check value.target (older format?)
            );

            return hasUrl;
          });
        });
        
        if (forwardingRules.length > 0) {
          // Get the URL from the first forwarding rule
          const forwardingAction = forwardingRules[0].actions.find(
            (action: PageRuleAction) => action.id === 'forwarding_url' // Use PageRuleAction type
          );

          let redirectUrl: string | undefined; // Initialize with undefined
          if (forwardingAction) { // Check if action was found
              const value = forwardingAction.value;
              if (typeof value === 'string') {
                redirectUrl = value;
              } else if (typeof value === 'object' && value !== null && typeof value.url === 'string') {
                redirectUrl = value.url;
              } else if (typeof value === 'object' && value !== null && typeof value.target === 'string') {
                redirectUrl = value.target;
              }
          }
          
          console.log(`[Cloudflare Redirects API] Found page rule redirect: ${redirectUrl}`);
          
          return NextResponse.json({
            success: true,
            redirectUrl
          });
        }
      }
      
      // If we didn't find a page rule, check DNS records for URL redirects
      console.log(`[Cloudflare Redirects API] Checking DNS records for zone ${zoneId}`);
      
      const dnsResponse = await fetch(
        `${CLOUDFLARE_API_URL}/zones/${zoneId}/dns_records?type=CNAME`,
        {
          method: 'GET',
          headers: getAuthHeaders()
        }
      );
      
      // Log the response for debugging
      const dnsData = await logApiResponse(dnsResponse, 'GET DNS records');
      
      // Define type for DNS Record
      interface DnsRecord {
        id: string;
        type: string;
        name: string;
        content: string;
        proxied: boolean;
        ttl: number;
        zone_id: string;
        zone_name: string;
        created_on: string;
        modified_on: string;
        locked: boolean;
        proxiable: boolean;
        priority?: number;
      }

      if (dnsResponse.ok && dnsData.success && Array.isArray(dnsData.result)) {
        // Check for root CNAME records which would indicate a redirect
        const rootCnames = dnsData.result.filter((record: DnsRecord) => // Use DnsRecord type
          (record.type === 'CNAME' && (record.name === '@' || record.name === dnsData.result[0]?.zone_name)) // Check against actual zone name if available
        );
        
        if (rootCnames.length > 0) {
          const redirectUrl = `https://${rootCnames[0].content}`;
          console.log(`[Cloudflare Redirects API] Found DNS CNAME redirect: ${redirectUrl}`);
          
          return NextResponse.json({
            success: true,
            redirectUrl
          });
        }
      }
      
      // No redirect found
      console.log(`[Cloudflare Redirects API] No redirect found for zone ${zoneId}`);
      return NextResponse.json({
        success: true,
        redirectUrl: null
      });
      
    } catch (error) {
      console.error(`[Cloudflare Redirects API] Error fetching redirect data:`, error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch redirect information' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('[Cloudflare Redirects API] Failed to process request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}