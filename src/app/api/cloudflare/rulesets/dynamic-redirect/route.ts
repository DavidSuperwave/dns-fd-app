import { NextResponse } from 'next/server';

// Use environment variables for authentication - try both token and global key methods
const CLOUDFLARE_AUTH_EMAIL = process.env.CLOUDFLARE_AUTH_EMAIL;
const CLOUDFLARE_GLOBAL_API_KEY = process.env.CLOUDFLARE_GLOBAL_API_KEY;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_API_BASE_URL = 'https://api.cloudflare.com/client/v4';

// Helper function to create authentication headers
function getCloudflareAuthHeaders(): Record<string, string> {
  // For Rulesets API, prefer API Token as it has better permission support
  if (CLOUDFLARE_API_TOKEN) {
    return {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    };
  }
  
  // Fallback to Global API Key method
  if (CLOUDFLARE_AUTH_EMAIL && CLOUDFLARE_GLOBAL_API_KEY) {
    return {
      'X-Auth-Email': CLOUDFLARE_AUTH_EMAIL,
      'X-Auth-Key': CLOUDFLARE_GLOBAL_API_KEY,
      'Content-Type': 'application/json',
    };
  }
  
  console.error('Cloudflare authentication credentials are not configured. Need either API token or (email + global key).');
  throw new Error('Cloudflare authentication credentials are not configured.');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const zoneId = searchParams.get('zoneId');

    if (!zoneId) {
      return NextResponse.json({ success: false, error: 'Zone ID is required.' }, { status: 400 });
    }

    const authHeaders = getCloudflareAuthHeaders(); // Use the helper
    
    // Log which auth method we're using (without exposing sensitive data)
    const authMethod = CLOUDFLARE_API_TOKEN ? 'Bearer Token' : 'Global API Key';
    console.log(`[DynamicRedirect] Using ${authMethod} authentication for zone ${zoneId}`);

    const phase = 'http_request_dynamic_redirect';
    const cloudflareUrl = `${CLOUDFLARE_API_BASE_URL}/zones/${zoneId}/rulesets/phases/${phase}/entrypoint`;
    
    console.log(`[DynamicRedirect] Making request to: ${cloudflareUrl}`);

    const response = await fetch(cloudflareUrl, {
      method: 'GET',
      headers: authHeaders,
    });

    const data = await response.json();
    
    console.log(`[DynamicRedirect] Cloudflare response status: ${response.status}`);
    console.log(`[DynamicRedirect] Cloudflare response data:`, JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('Cloudflare API Error (GET Ruleset):', data);
      const errorMessage = data?.errors?.[0]?.message || `Cloudflare API error: ${response.status}`;
      return NextResponse.json({ success: false, error: errorMessage, details: data.errors }, { status: response.status });
    }

    return NextResponse.json({ success: true, ruleset: data.result });

  } catch (error: any) {
    console.error('Error fetching Cloudflare ruleset:', error.message);
    if (error.message === 'Cloudflare authentication credentials are not configured.') {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error while fetching ruleset.', details: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { zoneId, ruleset } = body;

    if (!zoneId) {
      return NextResponse.json({ success: false, error: 'Zone ID is required.' }, { status: 400 });
    }
    if (!ruleset || typeof ruleset !== 'object' || !ruleset.rules ) { // Removed !ruleset.version check as it might not be used in payload
      return NextResponse.json({ success: false, error: 'Valid ruleset object (including rules) is required.' }, { status: 400 });
    }

    const authHeaders = getCloudflareAuthHeaders(); // Use the helper

    const phase = 'http_request_dynamic_redirect';
    const cloudflareUrl = `${CLOUDFLARE_API_BASE_URL}/zones/${zoneId}/rulesets/phases/${phase}/entrypoint`;

    const payloadForCloudflare = {
        description: ruleset.description || `Dynamic redirect rules for zone ${zoneId}`, // Provide a default description
        rules: ruleset.rules,
    };

    const response = await fetch(cloudflareUrl, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(payloadForCloudflare),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Cloudflare API Error (PUT Ruleset):', data);
      const errorMessage = data?.errors?.[0]?.message || `Cloudflare API error: ${response.status}`;
      return NextResponse.json({ success: false, error: errorMessage, details: data.errors }, { status: response.status });
    }

    return NextResponse.json({ success: true, ruleset: data.result, message: 'Dynamic redirect rule updated successfully.' });

  } catch (error: any) {
    console.error('Error updating Cloudflare ruleset:', error.message);
    if (error.message === 'Cloudflare authentication credentials are not configured.') {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    if (error instanceof SyntaxError && error.message.includes("JSON")) {
        return NextResponse.json({ success: false, error: 'Invalid JSON payload in request body.' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error while updating ruleset.', details: error.message }, { status: 500 });
  }
}