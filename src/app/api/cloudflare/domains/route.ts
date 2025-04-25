import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define interfaces
interface CloudflareDomain {
  id: string;
  name: string;
  status?: string;
  paused?: boolean;
  type?: string;
  created_on?: string;
  modified_on?: string;
}

// API configuration
const CLOUDFLARE_API_URL = 'https://api.cloudflare.com/client/v4';
const CLOUDFLARE_API_TOKEN = '3zYP5-L3oxluS5N3VNJNH7UXxh9NbxbyU0psh8uG';
const CLOUDFLARE_ACCOUNT_ID = '4dc0ca4b102ca90ce263dbec31af4a1f';

// Client-side friendly implementation that avoids server-only features
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    const perPage = url.searchParams.get('per_page') || '50';

    const apiUrl = `${CLOUDFLARE_API_URL}/accounts/${CLOUDFLARE_ACCOUNT_ID}/zones?page=${page}&per_page=${perPage}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        success: false,
        error: `API request failed: ${response.status} ${response.statusText}`,
        details: errorText
      }, { status: response.status });
    }

    const data = await response.json();
    
    // Count domains by status
    const statusCounts = (data.result || []).reduce((acc: Record<string, number>, domain: CloudflareDomain) => {
      const status = domain.paused ? 'paused' : (domain.status || 'unknown').toLowerCase();
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    
    return NextResponse.json({
      success: true,
      domains: data.result || [],
      resultInfo: data.result_info,
      statusBreakdown: statusCounts
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      success: false,
      error: errorMessage
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

    const response = await fetch(`${CLOUDFLARE_API_URL}/accounts/${CLOUDFLARE_ACCOUNT_ID}/zones`, {
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
      domain: data.result,
      nameservers: data.result.name_servers || [],
      originalNameservers: data.result.original_name_servers || []
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const domainId = pathParts[pathParts.length - 1];
    
    if (!domainId) {
      return NextResponse.json(
        { success: false, error: 'Domain ID is required' },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${CLOUDFLARE_API_URL}/accounts/${CLOUDFLARE_ACCOUNT_ID}/zones/${domainId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      return NextResponse.json({
        success: false,
        error: data?.errors?.[0]?.message || response.statusText
      }, { status: response.status || 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Domain deleted successfully'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}
