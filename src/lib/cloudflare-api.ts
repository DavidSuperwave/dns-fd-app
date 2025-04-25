// Cloudflare API client functions
// toast import removed as it's not used in this file

// Use a consistent API URL base
const API_BASE = '/api/cloudflare';

export interface CloudflareDomain {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  type: string;
  created_on: string;
  modified_on: string;
  redirect_url?: string | null;
  dns_records?: CloudflareDnsRecord[];
}

export interface CloudflareDnsRecord {
  id: string;
  name: string;
  type: string;
  content: string;
  ttl: number;
  proxied: boolean;
  locked?: boolean;
  created_on?: string;
  modified_on?: string;
}

export interface ResultInfo {
  page: number;
  per_page: number;
  total_pages: number;
  count: number;
  total_count: number;
}

// Create domain result interface that matches what the component expects
export interface CreateDomainResult {
  success: boolean;
  domain?: CloudflareDomain;
  nameservers?: string[];
  originalNameservers?: string[];
  warning?: string;
  error?: string;
}

/**
 * Fetch domains from the Cloudflare API
 */
export async function fetchDomains(page: number = 1, perPage: number = 50) {
  // Use the new zone-management endpoint 
  const response = await fetch(`${API_BASE}/zone-management?page=${page}&per_page=${perPage}`, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();

  if (!data.success) {
    console.error('Error fetching domains:', data.error);
    return { success: false, error: data.error || 'Failed to fetch domains' };
  }

  return data;
}

/**
 * Create a new domain in Cloudflare
 */
export async function createDomain(domainName: string, redirect?: string): Promise<CreateDomainResult> {
  try {
    // Use the new zone-management endpoint
    const response = await fetch(`${API_BASE}/zone-management`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: domainName,
        redirect_url: redirect || null
      }),
    });

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Failed to create domain'
      };
    }

    // Check API response for mock data indicators
    let warning = undefined;
    if (data.isMockData) {
      warning = "Using sample data for demonstration purposes. This is not a real domain registration.";
    } else if (data.status === "pending") {
      warning = "Domain added but registration is pending. Please check back later.";
    }

    return {
      success: true,
      domain: data.domain,
      nameservers: data.nameservers || [],
      originalNameservers: data.originalNameservers || [],
      warning
    };
  } catch (error) {
    console.error('Error creating domain:', error);
    return { 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating domain'
    };
  }
}

/**
 * Fetch DNS records for a domain from the Cloudflare API
 */
export async function fetchDnsRecords(domainId: string, page: number = 1, perPage: number = 100) {
  try {
    const response = await fetch(`${API_BASE}/dns-records?zoneId=${domainId}&page=${page}&per_page=${perPage}`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch DNS records');
    }

    return data;
  } catch (error) {
    console.error('Error fetching DNS records:', error);
    throw error;
  }
}

/**
 * Create a new DNS record for a domain
 */
export async function createDnsRecord(domainId: string, record: Partial<CloudflareDnsRecord>) {
  try {
    const response = await fetch(`${API_BASE}/dns-records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        zoneId: domainId,
        ...record,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to create DNS record');
    }

    return data;
  } catch (error) {
    console.error('Error creating DNS record:', error);
    throw error;
  }
}

/**
 * Update an existing DNS record
 */
export async function updateDnsRecord(
  domainId: string,
  recordId: string,
  record: Partial<CloudflareDnsRecord>
) {
  try {
    const response = await fetch(`${API_BASE}/dns-records/${recordId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        zoneId: domainId,
        ...record,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to update DNS record');
    }

    return data;
  } catch (error) {
    console.error('Error updating DNS record:', error);
    throw error;
  }
}

/**
 * Delete a DNS record
 */
export async function deleteDnsRecord(domainId: string, recordId: string) {
  try {
    const response = await fetch(`${API_BASE}/dns-records/${recordId}?zoneId=${domainId}`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to delete DNS record');
    }

    return data;
  } catch (error) {
    console.error('Error deleting DNS record:', error);
    throw error;
  }
}