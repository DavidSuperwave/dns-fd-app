/**
 * Cloudflare API Service
 * 
 * This service handles all interactions with the Cloudflare API
 * via our Next.js API routes to avoid CORS issues.
 */

/**
 * Enhanced error handling for API responses
 * Extracts useful error information from responses
 */
async function handleErrorResponse(response: Response): Promise<never> {
  let errorMessage = '';
  try {
    const errorData = await response.json();
    errorMessage = errorData.error || `API error: ${response.status} ${response.statusText}`;
    
    // Log detailed error information to console for debugging
    console.error('Cloudflare API error details:', {
      status: response.status,
      statusText: response.statusText,
      error: errorData
    });
  } catch (e) {
    errorMessage = `API error: ${response.status} ${response.statusText}`;
  }
  throw new Error(errorMessage);
}

/**
 * Fetch all domains (zones) from Cloudflare
 * @param page Page number for pagination
 * @param perPage Number of items per page
 * @returns Promise with the list of domains
 */
export async function fetchDomains(page: number = 1, perPage: number = 50) {
  try {
    console.log(`Fetching domains: page=${page}, perPage=${perPage}`);
    const response = await fetch(
      `/api/cloudflare/domains?page=${page}&per_page=${perPage}`
    );
    
    if (!response.ok) {
      return handleErrorResponse(response);
    }
    
    const data = await response.json();
    
    // Additional client-side validation
    if (!data.success) {
      console.error('API reported failure but returned 200 status:', data);
      throw new Error(data.error || 'Unknown API error');
    }
    
    return data;
  } catch (error) {
    console.error('Failed to fetch domains:', error);
    throw error;
  }
}

/**
 * Create a new domain (zone) in Cloudflare
 * @param domainName The domain name to create
 * @param accountId Optional account ID (uses default if not provided)
 * @returns Promise with the created domain and nameservers
 */
export async function createDomain(domainName: string, accountId?: string) {
  try {
    console.log(`Creating domain: ${domainName}`);
    
    // Validate domain name format client-side before sending request
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
    if (!domainRegex.test(domainName)) {
      throw new Error('Please enter a valid domain name (e.g., example.com)');
    }
    
    const response = await fetch('/api/cloudflare/domains', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: domainName,
        account: accountId ? { id: accountId } : undefined
      })
    });
    
    if (!response.ok) {
      return handleErrorResponse(response);
    }
    
    const data = await response.json();
    
    // Additional client-side validation
    if (!data.success) {
      console.error('API reported failure but returned 200 status:', data);
      throw new Error(data.error || 'Unknown API error');
    }
    
    // Check if nameservers were returned
    if (!data.nameservers || data.nameservers.length === 0) {
      console.warn('Domain created but no nameservers were returned:', data);
    }
    
    // Handle any warning messages for the UI
    if (data.warning) {
      console.warn('Domain created with warning:', data.warning);
    }
    
    return data;
  } catch (error) {
    console.error('Failed to create domain:', error);
    throw error;
  }
}

/**
 * Fetch DNS records for a specific domain
 * @param zoneId The Cloudflare Zone ID for the domain
 * @param page Page number for pagination
 * @param perPage Number of items per page
 * @returns Promise with the list of DNS records
 */
export async function fetchDnsRecords(zoneId: string, page: number = 1, perPage: number = 100) {
  try {
    console.log(`Fetching DNS records for zone ${zoneId}: page=${page}, perPage=${perPage}`);
    
    if (!zoneId) {
      throw new Error('Zone ID is required');
    }
    
    const response = await fetch(
      `/api/cloudflare/dns-records?zone_id=${zoneId}&page=${page}&per_page=${perPage}`
    );
    
    if (!response.ok) {
      return handleErrorResponse(response);
    }
    
    const data = await response.json();
    
    // Additional client-side validation
    if (!data.success) {
      console.error('API reported failure but returned 200 status:', data);
      throw new Error(data.error || 'Unknown API error');
    }
    
    // Handle any warning messages for the UI
    if (data.warning) {
      console.warn('DNS records fetched with warning:', data.warning);
    }
    
    return data;
  } catch (error) {
    console.error('Failed to fetch DNS records:', error);
    throw error;
  }
}

/**
 * Create a new DNS record
 * @param zoneId The Cloudflare Zone ID for the domain
 * @param record The DNS record to create
 * @returns Promise with the created DNS record
 */
export async function createDnsRecord(zoneId: string, record: any) {
  try {
    console.log(`Creating DNS record for zone ${zoneId}:`, record);
    
    if (!zoneId) {
      throw new Error('Zone ID is required');
    }
    
    // Validate required record fields
    if (!record.type || !record.name || !record.content) {
      throw new Error('DNS record must include type, name, and content');
    }
    
    const response = await fetch(
      `/api/cloudflare/dns-records?zone_id=${zoneId}`, 
      { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(record)
      }
    );
    
    if (!response.ok) {
      return handleErrorResponse(response);
    }
    
    const data = await response.json();
    
    // Additional client-side validation
    if (!data.success) {
      console.error('API reported failure but returned a 200 status:', data);
      throw new Error(data.error || 'Unknown API error');
    }
    
    // Handle any warning messages for the UI
    if (data.warning) {
      console.warn('DNS record created with warning:', data.warning);
    }
    
    return data.record;
  } catch (error) {
    console.error('Failed to create DNS record:', error);
    throw error;
  }
}

/**
 * Delete a DNS record
 * @param zoneId The Cloudflare Zone ID for the domain
 * @param recordId The ID of the DNS record to delete
 * @returns Promise with the deletion result
 */
export async function deleteDnsRecord(zoneId: string, recordId: string) {
  try {
    console.log(`Deleting DNS record ${recordId} from zone ${zoneId}`);
    
    if (!zoneId || !recordId) {
      throw new Error('Zone ID and Record ID are required');
    }
    
    const response = await fetch(
      `/api/cloudflare/dns-records?zone_id=${zoneId}&record_id=${recordId}`, 
      { 
        method: 'DELETE'
      }
    );
    
    if (!response.ok) {
      return handleErrorResponse(response);
    }
    
    const data = await response.json();
    
    // Additional client-side validation
    if (!data.success) {
      console.error('API reported failure but returned a 200 status:', data);
      throw new Error(data.error || 'Unknown API error');
    }
    
    // Handle any warning messages for the UI
    if (data.warning) {
      console.warn('DNS record deleted with warning:', data.warning);
    }
    
    return data.result;
  } catch (error) {
    console.error('Failed to delete DNS record:', error);
    throw error;
  }
}