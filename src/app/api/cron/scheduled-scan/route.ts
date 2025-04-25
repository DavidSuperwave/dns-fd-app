import { NextResponse } from 'next/server';
import { performBackgroundScan } from '../../../../lib/background-scan';

// Secret key to ensure only authorized requests can trigger the scan
const CRON_SECRET = process.env.CRON_SECRET || 'superwave-vercel-cron-secret';

// Set the runtime to edge for better performance
export const runtime = 'edge';

// Handle cron job request - this will be triggered by Vercel Cron
export async function GET(request: Request) {
  try {
    // Verify the request is authorized
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');
    
    // Authorize request
    if (secret !== CRON_SECRET) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Start the scan
    const result = await performBackgroundScan(50);
    
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
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}