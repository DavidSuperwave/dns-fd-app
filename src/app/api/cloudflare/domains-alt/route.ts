import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Set runtime configuration to use edge runtime
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// API configuration
const CLOUDFLARE_API_URL = 'https://api.cloudflare.com/client/v4';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    const perPage = url.searchParams.get('per_page') || '50';

    const apiUrl = `${CLOUDFLARE_API_URL}/zones?page=${page}&per_page=${perPage}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    });

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      domains: data.result || [],
      resultInfo: data.result_info
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;
    
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Domain name is required' },
        { status: 400 }
      );
    }

    const response = await fetch(`${CLOUDFLARE_API_URL}/zones`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        account: { id: CLOUDFLARE_ACCOUNT_ID },
        type: 'full'
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return NextResponse.json({
        success: false,
        error: data?.errors?.[0]?.message || response.statusText
      }, { status: response.status || 500 });
    }

    return NextResponse.json({
      success: true,
      domain: data.result
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}