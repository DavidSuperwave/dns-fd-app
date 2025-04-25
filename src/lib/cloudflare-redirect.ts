/**
 * Cloudflare Redirect Service
 * 
 * This service handles fetching and managing domain redirects from Cloudflare
 */

// Domain redirect type
export interface DomainRedirect {
  domainId: string;
  url: string | null;
  status: 'active' | 'disabled';
}

/**
 * Fetch redirect information for a domain by examining its DNS records
 * @param zoneId The Cloudflare Zone ID for the domain
 * @returns Promise with the redirect URL or null if no redirect exists
 */
export async function fetchDomainRedirect(zoneId: string): Promise<string | null> {
  try {
    console.log(`Fetching redirect information for zone ${zoneId}`);
    
    if (!zoneId) {
      throw new Error('Zone ID is required');
    }
    
    // We need to check DNS records to determine if domain has redirects set up
    const response = await fetch(
      `/api/cloudflare/redirects/${zoneId}`
    );
    
    if (!response.ok) {
      console.error(`Failed to fetch redirect for zone ${zoneId}:`, response.statusText);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.success) {
      console.error('API reported failure but returned 200 status:', data);
      return null;
    }
    
    return data.redirectUrl;
  } catch (error) {
    console.error('Failed to fetch domain redirect:', error);
    return null;
  }
}

/**
 * Fetch redirects for multiple domains in bulk
 * @param domainIds Array of domain IDs to fetch redirects for
 * @returns Promise with an object mapping domainId to redirect URL
 */
export async function fetchDomainRedirects(domainIds: string[]): Promise<Record<string, string | null>> {
  try {
    console.log(`Fetching redirects for ${domainIds.length} domains`);
    
    if (!domainIds.length) {
      return {};
    }
    
    const response = await fetch(
      `/api/cloudflare/redirects/bulk`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domainIds })
      }
    );
    
    if (!response.ok) {
      console.error('Failed to fetch bulk redirects:', response.statusText);
      return {};
    }
    
    const data = await response.json();
    
    if (!data.success) {
      console.error('API reported failure but returned 200 status:', data);
      return {};
    }
    
    return data.redirects || {};
  } catch (error) {
    console.error('Failed to fetch domain redirects in bulk:', error);
    return {};
  }
}