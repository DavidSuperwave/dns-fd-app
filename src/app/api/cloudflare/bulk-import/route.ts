import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase-admin';

// API configuration
const CLOUDFLARE_API_URL = 'https://api.cloudflare.com/client/v4';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

interface CloudflareDomain {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  type?: string;
  created_on: string;
  modified_on: string;
  name_servers?: string[];
  original_name_servers?: string[];
  original_registrar?: string;
  original_dnshost?: string;
  development_mode?: number;
}

interface ImportOptions {
  includeRedirects?: boolean;
  includeDnsRecords?: boolean;
  assignToUser?: string;
  filterByStatus?: string[];
  filterByName?: string;
  limit?: number;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: Array<{ domain: string; error: string }>;
  domains: Array<{
    name: string;
    status: string;
    imported: boolean;
    redirectUrl?: string;
    dnsRecords?: number;
  }>;
}

export async function POST(request: NextRequest) {
  const resolvedCookieStore = await cookies();

  // Create Supabase client for auth check
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return resolvedCookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            resolvedCookieStore.set({ name, value, ...options });
          } catch (error) {
            console.warn(`[Bulk Import] Failed to set cookie '${name}'.`, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            resolvedCookieStore.set({ name, value: '', ...options });
          } catch (error) {
            console.warn(`[Bulk Import] Failed to remove cookie '${name}'.`, error);
          }
        },
      },
    }
  );

  try {
    console.log('[Bulk Import] Starting bulk domain import...');

    // 1. Verify admin authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const isAdmin = session.user.email === 'admin@superwave.io' || session.user.user_metadata?.role === 'admin';
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin privileges required' },
        { status: 403 }
      );
    }

    // 2. Parse import options
    const body = await request.json();
    const options: ImportOptions = {
      includeRedirects: body.includeRedirects ?? true,
      includeDnsRecords: body.includeDnsRecords ?? false,
      assignToUser: body.assignToUser,
      filterByStatus: body.filterByStatus || ['active'],
      filterByName: body.filterByName,
      limit: body.limit || 100
    };

    console.log('[Bulk Import] Import options:', options);

    // 3. Fetch domains from Cloudflare
    const domains = await fetchCloudflareDomainsWithDetails(options);
    
    if (domains.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No domains found matching the specified criteria',
        imported: 0,
        skipped: 0,
        errors: [],
        domains: []
      });
    }

    // 4. Process and import domains
    const importResult = await processBulkImport(domains, options);

    console.log('[Bulk Import] Import completed:', {
      total: domains.length,
      imported: importResult.imported,
      skipped: importResult.skipped,
      errors: importResult.errors.length
    });

    return NextResponse.json(importResult);

  } catch (error) {
    console.error('[Bulk Import] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        imported: 0,
        skipped: 0,
        errors: [],
        domains: []
      },
      { status: 500 }
    );
  }
}

async function fetchCloudflareDomainsWithDetails(options: ImportOptions): Promise<CloudflareDomain[]> {
  if (!CLOUDFLARE_API_TOKEN) {
    throw new Error('Cloudflare API token not configured');
  }

  const allDomains: CloudflareDomain[] = [];
  let page = 1;
  const perPage = 50;

  while (true) {
    console.log(`[Bulk Import] Fetching page ${page} from Cloudflare...`);

    const response = await fetch(
      `${CLOUDFLARE_API_URL}/zones?page=${page}&per_page=${perPage}&status=${options.filterByStatus?.join(',') || 'active'}`,
      {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Cloudflare API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Cloudflare API failed: ${data.errors?.[0]?.message || 'Unknown error'}`);
    }

    const pageDomains = data.result || [];
    
    // Apply name filter if specified
    const filteredDomains = options.filterByName
      ? pageDomains.filter((domain: CloudflareDomain) => 
          domain.name.toLowerCase().includes(options.filterByName!.toLowerCase())
        )
      : pageDomains;

    allDomains.push(...filteredDomains);

    // Check if we've reached the limit or there are no more pages
    if (allDomains.length >= (options.limit || 100) || !data.result_info?.total_pages || page >= data.result_info.total_pages) {
      break;
    }

    page++;
  }

  // Trim to limit
  return allDomains.slice(0, options.limit || 100);
}

async function processBulkImport(domains: CloudflareDomain[], options: ImportOptions): Promise<ImportResult> {
  const adminSupabase = createAdminClient();
  const result: ImportResult = {
    success: true,
    imported: 0,
    skipped: 0,
    errors: [],
    domains: []
  };

  const timestamp = new Date().toISOString();

  for (const domain of domains) {
    try {
      console.log(`[Bulk Import] Processing domain: ${domain.name}`);

      // Check if domain already exists
      const { data: existingDomain } = await adminSupabase
        .from('domains')
        .select('id, name')
        .eq('cloudflare_id', domain.id)
        .single();

      if (existingDomain) {
        console.log(`[Bulk Import] Domain ${domain.name} already exists, skipping`);
        result.skipped++;
        result.domains.push({
          name: domain.name,
          status: domain.status,
          imported: false
        });
        continue;
      }

      // Prepare domain data
      const domainData = {
        cloudflare_id: domain.id,
        name: domain.name,
        status: domain.status,
        paused: domain.paused,
        type: domain.type || 'full',
        created_on: domain.created_on,
        modified_on: domain.modified_on,
        last_synced: timestamp,
        name_servers: domain.name_servers || [],
        original_name_servers: domain.original_name_servers || [],
        original_registrar: domain.original_registrar,
        development_mode: domain.development_mode
      };

      // Fetch redirect URL if requested
      let redirectUrl: string | null = null;
      if (options.includeRedirects) {
        redirectUrl = await fetchRedirectUrl(domain.id, domain.name);
        if (redirectUrl) {
          (domainData as any).redirect_url = redirectUrl;
        }
      }

      // Insert domain
      const { error: insertError } = await adminSupabase
        .from('domains')
        .insert(domainData);

      if (insertError) {
        throw new Error(`Failed to insert domain: ${insertError.message}`);
      }

      // Assign to user if specified
      if (options.assignToUser) {
        await assignDomainToUser(domain.name, options.assignToUser);
      }

      // Fetch DNS records if requested
      let dnsRecordCount = 0;
      if (options.includeDnsRecords) {
        dnsRecordCount = await fetchAndStoreDnsRecords(domain.id, domain.name);
      }

      result.imported++;
      result.domains.push({
        name: domain.name,
        status: domain.status,
        imported: true,
        redirectUrl: redirectUrl || undefined,
        dnsRecords: options.includeDnsRecords ? dnsRecordCount : undefined
      });

      console.log(`[Bulk Import] Successfully imported: ${domain.name}`);

    } catch (error) {
      console.error(`[Bulk Import] Error processing ${domain.name}:`, error);
      result.errors.push({
        domain: domain.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Log import summary
  await logImportSummary(result, options);

  return result;
}

async function fetchRedirectUrl(zoneId: string, domainName: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${CLOUDFLARE_API_URL}/zones/${zoneId}/pagerules`,
      {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.success) return null;

    const rules = data.result || [];
    const forwardingRule = rules.find((rule: any) => 
      rule.status === 'active' && 
      rule.actions?.some((action: any) => action.id === 'forwarding_url')
    );

    if (forwardingRule) {
      const action = forwardingRule.actions.find((a: any) => a.id === 'forwarding_url');
      if (action?.value?.url) return action.value.url;
      if (typeof action?.value === 'string') return action.value;
    }

    return null;
  } catch (error) {
    console.error(`[Bulk Import] Error fetching redirect for ${domainName}:`, error);
    return null;
  }
}

async function fetchAndStoreDnsRecords(zoneId: string, domainName: string): Promise<number> {
  try {
    const response = await fetch(
      `${CLOUDFLARE_API_URL}/zones/${zoneId}/dns_records`,
      {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) return 0;

    const data = await response.json();
    if (!data.success) return 0;

    const records = data.result || [];
    // Here you could store DNS records to a separate table if needed
    // For now, just return the count
    
    console.log(`[Bulk Import] Found ${records.length} DNS records for ${domainName}`);
    return records.length;
  } catch (error) {
    console.error(`[Bulk Import] Error fetching DNS records for ${domainName}:`, error);
    return 0;
  }
}

async function assignDomainToUser(domainName: string, userEmail: string): Promise<void> {
  const adminSupabase = createAdminClient();
  
  // Find user by email
  const { data: user } = await adminSupabase
    .from('user_profiles')
    .select('id')
    .eq('email', userEmail)
    .single();

  if (!user) {
    throw new Error(`User not found: ${userEmail}`);
  }

  // Create domain assignment
  await adminSupabase
    .from('domain_assignments')
    .insert({
      user_id: user.id,
      domain_name: domainName,
      assigned_at: new Date().toISOString()
    });
}

async function logImportSummary(result: ImportResult, options: ImportOptions): Promise<void> {
  const adminSupabase = createAdminClient();
  
  try {
    await adminSupabase
      .from('import_history')
      .insert({
        timestamp: new Date().toISOString(),
        type: 'bulk_cloudflare_import',
        total_processed: result.imported + result.skipped + result.errors.length,
        successful: result.imported,
        skipped: result.skipped,
        failed: result.errors.length,
        options: options,
        errors: result.errors
      });
  } catch (error) {
    console.error('[Bulk Import] Failed to log import summary:', error);
  }
}

// GET endpoint for import preview
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const preview = url.searchParams.get('preview') === 'true';
    const filterByStatus = url.searchParams.get('status')?.split(',') || ['active'];
    const filterByName = url.searchParams.get('name') || undefined;
    const limit = parseInt(url.searchParams.get('limit') || '10');

    if (!preview) {
      return NextResponse.json({ error: 'Use POST for actual import' }, { status: 400 });
    }

    const domains = await fetchCloudflareDomainsWithDetails({
      filterByStatus,
      filterByName,
      limit
    });

    return NextResponse.json({
      success: true,
      preview: true,
      total: domains.length,
      domains: domains.map(d => ({
        name: d.name,
        status: d.status,
        paused: d.paused,
        type: d.type,
        created_on: d.created_on
      }))
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
