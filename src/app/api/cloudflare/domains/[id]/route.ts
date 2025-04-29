import { NextResponse, NextRequest } from 'next/server';

// API configuration
const CLOUDFLARE_API_URL = 'https://api.cloudflare.com/client/v4';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN; // Use environment variable for token
// const CLOUDFLARE_ACCOUNT_ID = '4dc0ca4b102ca90ce263dbec31af4a1f'; // No longer needed for this direct zone path


const CLOUDFLARE_AUTH_EMAIL = 'dns@superwave.ai'; // Email associated with the token

// Using the standard Next.js App Router type for route handlers with explicit return type
export async function DELETE(
  request: NextRequest, // Use NextRequest
  { params }: { params: Promise<{ id: string }> } // Remove type annotation
): Promise<NextResponse> {
  try {
    const id = await params; // This is the Zone ID

    // Delete zone from Cloudflare using the direct zone endpoint
    // Reverting path based on diagnostic script that worked
    const response = await fetch(`${CLOUDFLARE_API_URL}/zones/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`, // Keep Bearer based on script
        'X-Auth-Email': CLOUDFLARE_AUTH_EMAIL, // Add email header based on script
        'Content-Type': 'application/json'
      }
    });

    // Check response status BEFORE trying to parse JSON
    if (!response.ok) {
        const errorBody = await response.text(); // Use const
        let errorMessage = `Cloudflare API Error (${response.status}): ${response.statusText}`;
        let parsedError = null;

        try {
            parsedError = JSON.parse(errorBody); // Try parsing the text as JSON
            errorMessage = parsedError.errors?.[0]?.message ||
                           parsedError.error ||
                           parsedError.messages?.[0]?.message ||
                           errorMessage; // Use parsed error if available
        } catch (_e) { // Prefix unused variable with underscore
            // If JSON parsing failed, use the raw text if it's short, otherwise keep the status text
            if (errorBody && errorBody.length < 500) { // Avoid logging huge HTML pages
               errorMessage = `Cloudflare API Error (${response.status}): ${errorBody}`;
            }
             console.warn("Cloudflare response was not valid JSON:", errorBody);
        }

        console.error('[Cloudflare Delete] Error:', {
            status: response.status,
            message: errorMessage,
            rawBody: errorBody, // Log raw body for debugging
            parsedError: parsedError
        });

        return NextResponse.json({
            success: false,
            error: errorMessage
        }, { status: response.status });
    }

    // If response.ok is true, THEN parse JSON
    const data = await response.json();
    console.log('[Cloudflare Delete] Response:', {
        status: response.status,
        ok: response.ok,
        data
    });

    // Cloudflare success responses might still have data.success = false
    if (!data.success) {
       const errorMessage = data.errors?.[0]?.message ||
                          data.error ||
                          data.messages?.[0]?.message ||
                          'Cloudflare indicated failure but provided no specific error.';

       console.error('[Cloudflare Delete] Logical Error:', {
         message: errorMessage,
         errors: data.errors,
         messages: data.messages
       });

       // Use 400 for logical errors if original status was 2xx, otherwise keep original status
       const errorStatus = response.status >= 200 && response.status < 300 ? 400 : response.status;
       return NextResponse.json({
         success: false,
         error: errorMessage
       }, { status: errorStatus });
    }

    // Success case
    return NextResponse.json({
        success: true,
        message: 'Domain deleted successfully',
        result: data.result
    });
  } catch (error) {
    console.error('Error deleting domain:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}