import { NextResponse, NextRequest } from 'next/server';
import { performBackgroundScan } from '../../../../lib/background-scan';

// Configure for edge runtime
export const runtime = 'edge';

// Secret key to ensure only authorized requests can trigger the scan
const SCAN_SECRET_KEY = process.env.SCAN_SECRET_KEY || 'superwave-scheduled-scan-key';

export async function POST(request: NextRequest) {
  try {
    // Validate the request
    let isAuthorized = false;

    // Check for authorization header
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ') && authHeader.substring(7) === SCAN_SECRET_KEY) {
      isAuthorized = true;
    }

    // Also check for key in request body
    if (!isAuthorized) {
      try {
        const body = await request.json();
        if (body.key === SCAN_SECRET_KEY) {
          isAuthorized = true;
        }
      } catch { // Remove unused 'e' variable
        // Failed to parse JSON body, continue with authorization check
        console.warn('[Scheduled Scan] Failed to parse request body as JSON during auth check.');
      }
    }

    // Check URL parameters as a last resort
    if (!isAuthorized) {
      const url = new URL(request.url);
      const keyParam = url.searchParams.get('key');
      if (keyParam === SCAN_SECRET_KEY) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Determine per_page parameter (default: 50)
    let perPage = 50;
    try {
      const url = new URL(request.url);
      const perPageParam = url.searchParams.get('per_page');
      if (perPageParam) {
        const parsedPerPage = parseInt(perPageParam);
        if (!isNaN(parsedPerPage) && parsedPerPage > 0) {
          perPage = parsedPerPage;
        }
      }
    } catch { // Remove unused 'e' variable
      // Use default if parameter parsing fails
      console.warn('[Scheduled Scan] Failed to parse per_page URL parameter.');
    }

    // Start the scan
    const result = await performBackgroundScan(perPage);

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Failed to complete scan' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Scan completed successfully',
      result
    });
  } catch (error) {
    console.error('[Scheduled Scan] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}