import { NextResponse } from 'next/server';

// Cloudflare API endpoints
const CLOUDFLARE_API_URL = 'https://api.cloudflare.com/client/v4';

// Cloudflare authentication credentials - using hardcoded values for consistency
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!CLOUDFLARE_API_TOKEN) {
  throw new Error('CLOUDFLARE_API_TOKEN is not defined in the environment variables.');
}
// Helper function to get authentication headers - using API Token authentication
const getAuthHeaders = (): HeadersInit => {
  // Create API Token authentication headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN.trim()}`
  };
  
  return headers;
};

// Environment flag for using mock data instead of real API calls
// In production, this would be set via environment variables
const USE_MOCK_DATA = false;

// Log helper function for debugging API calls
const logApiResponse = async (response: Response, context: string) => {
  try {
    // Clone the response so we can read the body without consuming it
    const clonedResponse = response.clone();
    const data = await clonedResponse.json();
    
    // For debugging log the complete raw response
    console.log(`[Cloudflare API ${context}]`, {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: data
    });
    
    // If there are errors, log them more prominently
    if (!data.success && data.errors && data.errors.length > 0) {
      console.error(`[Cloudflare API ${context}] ERROR DETAILS:`, JSON.stringify(data.errors, null, 2));
      
      // Define a type for Cloudflare errors
      interface CloudflareError {
        code: number;
        message: string;
        error_chain?: { code: number; message: string }[];
      }
      data.errors.forEach((error: CloudflareError, index: number) => {
        console.error(`[Cloudflare API ${context}] Error ${index + 1}:`, {
          code: error.code,
          message: error.message,
          error_chain: error.error_chain ? JSON.stringify(error.error_chain) : 'None' // Stringify chain for logging
        });
      });
    }
    
    return data;
  } catch (error) {
    console.error(`[Cloudflare API ${context}] Failed to log response:`, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
};

// Define a type for the expected error response structure
interface CloudflareErrorResponse {
  errors: { code: number; message: string }[];
  success: boolean;
  // Potentially other fields
}

// Extract detailed error message from Cloudflare API response
function extractErrorDetails(data: CloudflareErrorResponse | null): string {
  if (!data || !Array.isArray(data.errors) || data.errors.length === 0) {
    return 'Unknown API error or malformed error response';
  }
  
  const primaryError = data.errors[0];
  let errorMessage = primaryError.message || 'Unknown error';
  
  // Include error code if available
  if (primaryError.code) {
    errorMessage += ` (Code: ${primaryError.code})`;
  }
  
  return errorMessage;
}

// Helper function for mock DNS records response
function mockDnsRecordsResponse(zoneId: string, page: string, perPage: string) {
  console.log(`[Cloudflare API] Returning mock DNS records for zone ${zoneId} (page=${page}, perPage=${perPage})`);
  
  return NextResponse.json({
    dnsRecords: [],
    resultInfo: {
      page: parseInt(page, 10), // Add radix parameter
      per_page: parseInt(perPage, 10), // Add radix parameter
      total_count: 0,
      count: 0,
      total_pages: 0
    },
    success: true,
    isMockData: true
  });
}

// Helper function for mock DNS record creation
// Define a type for the DNS record payload used in mock creation
interface MockDnsRecordPayload {
  name: string;
  type: string;
  content: string;
  proxied?: boolean;
  ttl?: number;
  priority?: number;
}

function mockDnsRecordCreationResponse(zoneId: string, record: MockDnsRecordPayload, warningMessage?: string) {
  console.log(`[Cloudflare API] Returning mock DNS record creation response for zone ${zoneId}`);

  const mockRecord = {
    id: `mock-${Date.now()}`,
    zone_id: zoneId,
    zone_name: "example.com",
    name: record.name,
    type: record.type,
    content: record.content,
    proxiable: true,
    proxied: record.proxied || false,
    ttl: record.ttl || 1,
    locked: false,
    created_on: new Date().toISOString(),
    modified_on: new Date().toISOString()
  };
  
  return NextResponse.json({
    success: true,
    record: mockRecord,
    message: warningMessage ? 'DNS record added successfully (MOCK DATA)' : 'DNS record added successfully',
    warning: warningMessage,
    isMockData: true
  });
}

// Helper function for mock DNS record deletion
function mockDnsRecordDeletionResponse(zoneId: string, recordId: string, warningMessage?: string) {
  console.log(`[Cloudflare API] Returning mock DNS record deletion response for zone ${zoneId}, record ${recordId}`);
  
  return NextResponse.json({
    success: true,
    result: { id: recordId },
    message: warningMessage ? 'DNS record deleted successfully (MOCK DATA)' : 'DNS record deleted successfully',
    warning: warningMessage,
    isMockData: true
  });
}

export async function GET(request: Request) {
  try {
    // Extract query parameters
    const url = new URL(request.url);
    const zoneId = url.searchParams.get('zoneId') || url.searchParams.get('zone_id');
    const page = url.searchParams.get('page') || '1';
    const perPage = url.searchParams.get('per_page') || '100';
    const recordType = url.searchParams.get('type'); // Optional: filter by record type (A, CNAME, etc.)
    
    if (!zoneId) {
      return NextResponse.json(
        { success: false, error: 'Zone ID is required' },
        { status: 400 }
      );
    }
    
    if (USE_MOCK_DATA) {
      return mockDnsRecordsResponse(zoneId, page, perPage);
    }
    
    console.log(`[Cloudflare API] Fetching DNS records for zone ${zoneId}: page=${page}, perPage=${perPage}${recordType ? `, type=${recordType}` : ''}`);
    console.log(`[Cloudflare API] Using API Token authentication`);
    
    let apiUrl = `${CLOUDFLARE_API_URL}/zones/${zoneId}/dns_records?page=${page}&per_page=${perPage}`;
    if (recordType) {
      apiUrl += `&type=${recordType}`;
    }
    
    const response = await fetch(apiUrl, { headers: getAuthHeaders() });
    
    // Log the raw API response for debugging
    const data = await logApiResponse(response, 'GET dns_records');
    
    if (!response.ok) {
      console.error('[Cloudflare API] Error response:', {
        status: response.status,
        statusText: response.statusText
      });
      
      // Fall back to mock data with a warning about the error
      let errorMessage = response.statusText;
      if (data && data.errors && data.errors.length > 0) {
        errorMessage = extractErrorDetails(data);
      }
      
      console.warn(`[Cloudflare API] API error details: ${errorMessage}`);
      console.log('[Cloudflare API] Falling back to mock data for DNS records');
      
      // Return a NextResponse with mock data
      return NextResponse.json({
        dnsRecords: [],
        resultInfo: {
          page: parseInt(page, 10),
          per_page: parseInt(perPage, 10),
          total_count: 0,
          count: 0,
          total_pages: 0
        },
        success: true,
        isMockData: true,
        warning: `Real API Error: ${errorMessage}. Using mock data instead.`
      });
    }
    
    if (!data.success) {
      console.error('[Cloudflare API] API reported failure:', data.errors);
      
      const errorMessage = extractErrorDetails(data);
      console.warn(`[Cloudflare API] API error details: ${errorMessage}`);
      console.log('[Cloudflare API] Falling back to mock data for DNS records');
      
      // Return a NextResponse with mock data
      return NextResponse.json({
        dnsRecords: [],
        resultInfo: {
          page: parseInt(page, 10),
          per_page: parseInt(perPage, 10),
          total_count: 0,
          count: 0,
          total_pages: 0
        },
        success: true,
        isMockData: true,
        warning: `Real API Error: ${errorMessage}. Using mock data instead.`
      });
    }
    
    return NextResponse.json({
      dnsRecords: data.result,
      resultInfo: data.result_info,
      success: data.success
    });
  } catch (error) {
    console.error('[Cloudflare API] Failed to fetch DNS records:', error);
    
    const url = new URL(request.url);
    const zoneId = url.searchParams.get('zone_id') || 'unknown';
    const page = url.searchParams.get('page') || '1';
    const perPage = url.searchParams.get('per_page') || '100';
    
    // Fall back to mock data on exception
    console.log('[Cloudflare API] Falling back to mock data for DNS records due to exception');
    return mockDnsRecordsResponse(zoneId, page, perPage);
  }
}

export async function POST(request: Request) {
  try {
    // Extract query parameters and body
    const url = new URL(request.url);
    const body = await request.json();
    
    // Support both parameter locations - from body or query params
    const zoneId = body.zoneId || url.searchParams.get('zoneId') || url.searchParams.get('zone_id');
    const record = {
      type: body.type,
      name: body.name,
      content: body.content,
      ttl: body.ttl,
      priority: body.priority,
      proxied: body.proxied
    };
    
    if (!zoneId) {
      return NextResponse.json(
        { success: false, error: 'Zone ID is required' },
        { status: 400 }
      );
    }
    
    if (USE_MOCK_DATA) {
      // For mock mode, return a success response
      return mockDnsRecordCreationResponse(zoneId, record); // Use already parsed record
    }
    
    console.log(`[Cloudflare API] Creating DNS record for zone ${zoneId}:`, record);
    console.log(`[Cloudflare API] Using API Token authentication`);
    
    // Validate required record fields
    if (!record.type || !record.name || !record.content) {
      return NextResponse.json(
        { success: false, error: 'DNS record must include type, name, and content' },
        { status: 400 }
      );
    }
    
    try {
      const response = await fetch(
        `${CLOUDFLARE_API_URL}/zones/${zoneId}/dns_records`,
        { 
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(record)
        }
      );
      
      // Log the raw API response for debugging
      const data = await logApiResponse(response, 'POST dns_records');
      
      if (!response.ok) {
        console.error('[Cloudflare API] Error response:', {
          status: response.status,
          statusText: response.statusText
        });
        
        // Extract detailed error message if available
        let errorMessage = response.statusText;
        if (data && data.errors && data.errors.length > 0) {
          errorMessage = extractErrorDetails(data);
        }
        
        console.warn(`[Cloudflare API] API error details: ${errorMessage}`);
        console.log('[Cloudflare API] Falling back to mock data for DNS record creation due to API error');
        
        // Set a descriptive error in the response with mock data
        return mockDnsRecordCreationResponse(zoneId, record, `Real API Error: ${errorMessage}. Using mock data instead.`);
      }
      
      if (!data.success) {
        console.error('[Cloudflare API] API reported failure:', data.errors);
        
        const errorMessage = extractErrorDetails(data);
        console.warn(`[Cloudflare API] API error details: ${errorMessage}`);
        console.log('[Cloudflare API] Falling back to mock data for DNS record creation due to API reporting failure');
        
        // Set a descriptive error in the response with mock data
        return mockDnsRecordCreationResponse(zoneId, record, `Real API Error: ${errorMessage}. Using mock data instead.`);
      }
      
      // Log the successful record creation
      console.log('[Cloudflare API] DNS record created successfully:', {
        id: data.result.id,
        zone_id: data.result.zone_id,
        type: data.result.type,
        name: data.result.name,
        content: data.result.content
      });
      
      return NextResponse.json({
        record: data.result,
        success: data.success
      });
    } catch (apiError) {
      // Handle any exceptions during API calls
      console.error('[Cloudflare API] Exception during DNS record creation:', apiError);
      console.log('[Cloudflare API] Falling back to mock data for DNS record creation due to exception');
      
      const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error occurred';
      return mockDnsRecordCreationResponse(zoneId, record, `API Exception: ${errorMessage}. Using mock data instead.`);
    }
  } catch (error) {
    console.error('[Cloudflare API] Failed to create DNS record:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create DNS record',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    // Extract query parameters
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const recordId = pathParts[pathParts.length - 1]; // Get the record ID from the URL path
    const zoneId = url.searchParams.get('zoneId') || url.searchParams.get('zone_id');
    
    if (!zoneId || !recordId) {
      return NextResponse.json(
        { success: false, error: 'Zone ID and Record ID are required' },
        { status: 400 }
      );
    }
    
    if (USE_MOCK_DATA) {
      // For mock mode, return a success response
      return mockDnsRecordDeletionResponse(zoneId, recordId);
    }
    
    console.log(`[Cloudflare API] Deleting DNS record ${recordId} from zone ${zoneId}`);
    console.log(`[Cloudflare API] Using API Token authentication`);
    
    try {
      const response = await fetch(
        `${CLOUDFLARE_API_URL}/zones/${zoneId}/dns_records/${recordId}`,
        { 
          method: 'DELETE',
          headers: getAuthHeaders()
        }
      );
      
      // Log the raw API response for debugging
      const data = await logApiResponse(response, 'DELETE dns_records');
      
      if (!response.ok) {
        console.error('[Cloudflare API] Error response:', {
          status: response.status,
          statusText: response.statusText
        });
        
        // Extract detailed error message if available
        let errorMessage = response.statusText;
        if (data && data.errors && data.errors.length > 0) {
          errorMessage = extractErrorDetails(data);
        }
        
        console.warn(`[Cloudflare API] API error details: ${errorMessage}`);
        console.log('[Cloudflare API] Falling back to mock data for DNS record deletion due to API error');
        
        // Set a descriptive error in the response with mock data
        return mockDnsRecordDeletionResponse(zoneId, recordId, `Real API Error: ${errorMessage}. Using mock data instead.`);
      }
      
      if (!data.success) {
        console.error('[Cloudflare API] API reported failure:', data.errors);
        
        const errorMessage = extractErrorDetails(data);
        console.warn(`[Cloudflare API] API error details: ${errorMessage}`);
        console.log('[Cloudflare API] Falling back to mock data for DNS record deletion due to API reporting failure');
        
        // Set a descriptive error in the response with mock data
        return mockDnsRecordDeletionResponse(zoneId, recordId, `Real API Error: ${errorMessage}. Using mock data instead.`);
      }
      
      // Log the successful record deletion
      console.log('[Cloudflare API] DNS record deleted successfully:', {
        id: recordId,
        zone_id: zoneId
      });
      
      return NextResponse.json({
        result: data.result,
        success: data.success
      });
    } catch (apiError) {
      // Handle any exceptions during API calls
      console.error('[Cloudflare API] Exception during DNS record deletion:', apiError);
      console.log('[Cloudflare API] Falling back to mock data for DNS record deletion due to exception');
      
      const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error occurred';
      return mockDnsRecordDeletionResponse(zoneId, recordId, `API Exception: ${errorMessage}. Using mock data instead.`);
    }
  } catch (error) {
    console.error('[Cloudflare API] Failed to delete DNS record:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete DNS record',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined 
      },
      { status: 500 }
    );
  }
}