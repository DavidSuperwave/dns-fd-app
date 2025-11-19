import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase-admin';
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';

type CountResponse = {
  count: number | null;
  error: PostgrestError | null;
};

function ensureCount(result: CountResponse, label: string) {
  if (result.error) {
    console.error(`[Admin Analytics] Failed to fetch ${label}:`, result.error);
    throw result.error;
  }
  return result.count ?? 0;
}

export async function GET(_request: NextRequest) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@superwave.io';
    const isAdmin =
      user.email === adminEmail ||
      user.user_metadata?.role === 'admin' ||
      user.user_metadata?.is_admin === true;

    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    let adminClient: SupabaseClient;
    try {
      adminClient = createAdminClient();
    } catch (error) {
      console.error('[Admin Analytics] Unable to create admin client:', error);
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const HEALTHY_INBOX_STATUSES = ['active', 'ready', 'enabled', 'healthy'];
    const healthyStatusFilter = HEALTHY_INBOX_STATUSES.map((status) => `"${status}"`).join(',');
    const DEPLOYED_STATUS = 'Deployed';

    const [
      totalUsersResult,
      activeUsersResult,
      pendingInvitesResult,
      totalDomainsResult,
      domainsDeployingResult,
      totalInboxingResult,
      inboxingIssuesResult,
      totalProjectsResult,
      generatingProjectsResult,
      completedProjectsResult,
      totalCompaniesResult,
      pendingCompaniesResult,
      recentUsersResult,
      recentDomainsResult,
      recentProjectsResult,
      recentInboxingResult,
      inboxingSyncResult,
    ] = await Promise.all([
      adminClient.from('user_profiles').select('*', { count: 'exact', head: true }),
      adminClient.from('user_profiles').select('*', { count: 'exact', head: true }).eq('active', true),
      adminClient.from('invitations').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      adminClient.from('domains').select('*', { count: 'exact', head: true }),
      adminClient.from('domains').select('*', { count: 'exact', head: true }).not('deployment_status', 'eq', DEPLOYED_STATUS),
      adminClient.from('inboxing_domains').select('*', { count: 'exact', head: true }),
      adminClient
        .from('inboxing_domains')
        .select('*', { count: 'exact', head: true })
        .not('status', 'in', `(${healthyStatusFilter})`),
      adminClient.from('projects').select('*', { count: 'exact', head: true }),
      adminClient.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'generating'),
      adminClient.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      adminClient.from('company_profiles').select('*', { count: 'exact', head: true }),
      adminClient.from('company_profiles').select('*', { count: 'exact', head: true }).neq('workflow_status', 'completed'),
      adminClient
        .from('user_profiles')
        .select('id,email,role,status,active,created_at')
        .order('created_at', { ascending: false })
        .limit(8),
      adminClient
        .from('domains')
        .select('id,name,status,deployment_status,modified_on,last_synced,admin_email')
        .order('modified_on', { ascending: false })
        .limit(8),
      adminClient
        .from('projects')
        .select('id,name,status,updated_at,company_profile_id')
        .order('updated_at', { ascending: false })
        .limit(8),
      adminClient
        .from('inboxing_domains')
        .select('id,domain_name,status,is_active,last_synced_at,tenant_primary_domain,updated_at')
        .order('updated_at', { ascending: false })
        .limit(8),
      adminClient
        .from('inboxing_sync_runs')
        .select('id,started_at,finished_at,status,total_domains,upserted_domains,error')
        .order('started_at', { ascending: false })
        .limit(1),
    ]);

    if (recentUsersResult.error) {
      console.error('[Admin Analytics] Failed to load recent users:', recentUsersResult.error);
      throw recentUsersResult.error;
    }
    if (recentDomainsResult.error) {
      console.error('[Admin Analytics] Failed to load recent domains:', recentDomainsResult.error);
      throw recentDomainsResult.error;
    }
    if (recentProjectsResult.error) {
      console.error('[Admin Analytics] Failed to load recent projects:', recentProjectsResult.error);
      throw recentProjectsResult.error;
    }
    if (recentInboxingResult.error) {
      console.error('[Admin Analytics] Failed to load recent inboxing domains:', recentInboxingResult.error);
      throw recentInboxingResult.error;
    }
    if (inboxingSyncResult.error) {
      console.error('[Admin Analytics] Failed to load inboxing sync runs:', inboxingSyncResult.error);
      throw inboxingSyncResult.error;
    }

    const recentUsers = recentUsersResult.data ?? [];
    const recentDomains = recentDomainsResult.data ?? [];
    const recentProjects = recentProjectsResult.data ?? [];
    const recentInboxing = recentInboxingResult.data ?? [];
    const lastRun = inboxingSyncResult.data?.[0] ?? null;

    const payload = {
      success: true,
      generatedAt: new Date().toISOString(),
      metrics: {
        totalUsers: ensureCount(totalUsersResult, 'total users'),
        activeUsers: ensureCount(activeUsersResult, 'active users'),
        pendingInvites: ensureCount(pendingInvitesResult, 'pending invitations'),
        totalDomains: ensureCount(totalDomainsResult, 'total domains'),
        domainsInProgress: ensureCount(domainsDeployingResult, 'domains in progress'),
        inboxingTracked: ensureCount(totalInboxingResult, 'inboxing domains'),
        inboxingIssues: ensureCount(inboxingIssuesResult, 'inboxing issues'),
        totalProjects: ensureCount(totalProjectsResult, 'projects'),
        generatingProjects: ensureCount(generatingProjectsResult, 'generating projects'),
        completedProjects: ensureCount(completedProjectsResult, 'completed projects'),
        totalCompanies: ensureCount(totalCompaniesResult, 'company profiles'),
        pendingCompanies: ensureCount(pendingCompaniesResult, 'pending company profiles'),
      },
      liveTables: {
        users: recentUsers,
        domains: recentDomains,
        projects: recentProjects,
        inboxing: recentInboxing,
      },
      syncStats: {
        lastRun,
      },
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('[Admin Analytics] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}


