import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Set runtime configuration
export const dynamic = 'force-dynamic';

// API configuration
const CLOUDFLARE_API_URL = 'https://api.cloudflare.com/client/v4';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN; // Ensure token is set
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID; // Add missing Account ID

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const domain = url.searchParams.get('domain');

    if (!domain) {
      return NextResponse.json({
        success: false,
        error: 'Domain parameter is required'
      }, { status: 400 });
    }

    // Query Cloudflare for domain info
    const response = await fetch(`${CLOUDFLARE_API_URL}/accounts/${CLOUDFLARE_ACCOUNT_ID}/zones?name=${domain}`, {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return NextResponse.json({
        success: false,
        error: data?.errors?.[0]?.message || response.statusText
      }, { status: response.status || 500 });
    }

    // If domain exists, return its nameservers
    if (data.result?.length > 0) {
      return NextResponse.json({
        success: true,
        nameservers: data.result[0].name_servers || []
      });
    }

    // If domain doesn't exist in Cloudflare, try to get its current nameservers
    const whoisResponse = await fetch(`${CLOUDFLARE_API_URL}/accounts/${CLOUDFLARE_ACCOUNT_ID}/zones/whois?name=${domain}`, {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const whoisData = await whoisResponse.json();

    if (!whoisResponse.ok || !whoisData.success) {
      return NextResponse.json({
        success: true,
        nameservers: null
      });
    }

    // Extract nameservers from WHOIS data
    const nameservers = whoisData.result?.name_servers || null;

    return NextResponse.json({
      success: true,
      nameservers
    });

  } catch (error) {
    console.error('Error fetching nameservers:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}