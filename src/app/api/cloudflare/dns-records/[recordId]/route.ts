import { NextResponse } from 'next/server';

const CLOUDFLARE_API_URL = 'https://api.cloudflare.com/client/v4';

// Cloudflare authentication credentials - using hardcoded values for consistency
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!CLOUDFLARE_API_TOKEN) {
  throw new Error('CLOUDFLARE_API_TOKEN is not defined in the environment variables.');
}

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
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const recordId = (await params).id;
    if (!recordId || recordId.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Invalid Record ID' },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const zoneId = url.searchParams.get('zoneId') || url.searchParams.get('zone_id');
    
    if (!zoneId) {
      return NextResponse.json(
        { success: false, error: 'Zone ID is required' },
        { status: 400 }
      );
    }

    if (USE_MOCK_DATA) {
      return mockDnsRecordDeletionResponse(zoneId, recordId);
    }

    console.log(`[Cloudflare API] Deleting DNS record ${recordId} from zone ${zoneId}`);
    
    const response = await fetch(
      `${CLOUDFLARE_API_URL}/zones/${zoneId}/dns_records/${recordId}`,
      { 
        method: 'DELETE',
        headers: getAuthHeaders()
      }
    );
    
    const data = await logApiResponse(response, 'DELETE dns_records');
    
    if (!response.ok) {
      const errorMessage = data ? extractErrorDetails(data) : response.statusText;
      console.error('[Cloudflare API] Error:', errorMessage);
      return NextResponse.json({ success: false, error: errorMessage }, { status: response.status });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Cloudflare API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete DNS record' },
      { status: 500 }
    );
  }
}