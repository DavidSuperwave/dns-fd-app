import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { fetchAllInboxingDomains } from '@/lib/inboxing-api';
import { getSupabaseAdminClient } from '@/lib/supabase-client';

const CHUNK_SIZE = 500;

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

async function assertAdmin(request: NextRequest) {
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
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            console.warn('[Inboxing sync] Failed to set cookie', name, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            console.warn('[Inboxing sync] Failed to remove cookie', name, error);
          }
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { status: 401, body: { error: 'Not authenticated' } as const };
  }

  const adminClient = getSupabaseAdminClient();
  let isAdmin =
    user.user_metadata?.role === 'admin' ||
    user.app_metadata?.role === 'admin' ||
    user.email === process.env.ADMIN_EMAIL;

  if (!isAdmin && adminClient) {
    const { data: profile } = await adminClient
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.role === 'admin') {
      isAdmin = true;
    }
  }

  if (!isAdmin) {
    return { status: 403, body: { error: 'Forbidden' } as const };
  }

  return { status: 200, user };
}

export async function POST(request: NextRequest) {
  const authResult = await assertAdmin(request);
  if (authResult.status !== 200) {
    return NextResponse.json(authResult.body, { status: authResult.status });
  }

  const adminUser = authResult.user!;
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 });
  }

  const syncStartPayload = {
    status: 'running',
    triggered_by: adminUser.id,
    triggered_email: adminUser.email,
  };

  const { data: syncStart, error: syncInsertError } = await supabase
    .from('inboxing_sync_runs')
    .insert(syncStartPayload)
    .select()
    .single();

  if (syncInsertError || !syncStart) {
    console.error('[Inboxing sync] Failed to create sync run record:', syncInsertError);
    return NextResponse.json({ error: 'Failed to start sync run' }, { status: 500 });
  }

  const syncRunId = syncStart.id;
  const finishSync = async (update: Record<string, unknown>) => {
    await supabase
      .from('inboxing_sync_runs')
      .update({
        finished_at: new Date().toISOString(),
        ...update,
      })
      .eq('id', syncRunId);
  };

  try {
    const remoteDomains = await fetchAllInboxingDomains();
    const now = new Date().toISOString();

    const inboxingUpsertPayload = remoteDomains.map((domain) => ({
      inboxing_id: domain.id,
      domain_name: domain.domain_name,
      status: domain.status,
      admin_email: domain.admin_email,
      display_name: domain.display_name,
      tenant_primary_domain: domain.tenant_info?.primary_domain ?? null,
      tenant_status: domain.tenant_info?.status ?? null,
      tenant_id: domain.tenant_info?.tenant_id ?? null,
      tenant_domain_limit: domain.tenant_info?.domain_limit ?? null,
      cloudflare_email: domain.cloudflare_info?.email ?? null,
      cloudflare_account_id: domain.cloudflare_info?.account_id ?? null,
      last_remote_update: domain.updated_at ?? domain.created_at ?? null,
      last_synced_at: now,
      is_active: true,
      metadata: {
        raw_updated_at: domain.updated_at,
        raw_created_at: domain.created_at,
      },
    }));

    for (const chunk of chunkArray(inboxingUpsertPayload, CHUNK_SIZE)) {
      const { error } = await supabase.from('inboxing_domains').upsert(chunk, { onConflict: 'inboxing_id' });
      if (error) {
        throw error;
      }
    }

    const remoteIds = new Set(remoteDomains.map((domain) => domain.id));

    const { data: existingInboxingRows, error: existingInboxingError } = await supabase
      .from('inboxing_domains')
      .select('id, inboxing_id, is_active, domain_name');

    if (existingInboxingError) {
      throw existingInboxingError;
    }

    const toDisable = (existingInboxingRows ?? [])
      .filter((row) => !remoteIds.has(row.inboxing_id) && row.is_active)
      .map((row) => row.id);

    for (const chunk of chunkArray(toDisable, CHUNK_SIZE)) {
      const { error } = await supabase
        .from('inboxing_domains')
        .update({ is_active: false })
        .in('id', chunk);
      if (error) {
        throw error;
      }
    }

    const inboxingMap = new Map(
      (existingInboxingRows ?? []).map((row) => [row.inboxing_id, row.id])
    );

    const { data: existingDomains, error: existingDomainsError } = await supabase
      .from('domains')
      .select('id, name, inboxing_domain_id, cloudflare_id');

    if (existingDomainsError) {
      throw existingDomainsError;
    }

    const domainsByName = new Map<string, { id: number; inboxing_domain_id: number | null }>();
    const domainsByInboxingId = new Map<number, { id: number }>();

    (existingDomains ?? []).forEach((domain) => {
      domainsByName.set(domain.name.toLowerCase(), { id: domain.id, inboxing_domain_id: domain.inboxing_domain_id ?? null });
      if (domain.inboxing_domain_id) {
        domainsByInboxingId.set(domain.inboxing_domain_id, { id: domain.id });
      }
    });

    const domainInserts: any[] = [];
    const domainUpdates: any[] = [];

    remoteDomains.forEach((remote) => {
      const normalizedName = remote.domain_name.toLowerCase();
      const inboxingDomainId = inboxingMap.get(remote.id);
      if (!inboxingDomainId) {
        return;
      }

      const existingByInboxing = domainsByInboxingId.get(inboxingDomainId);
      const existingByName = domainsByName.get(normalizedName);
      const target = existingByInboxing ?? existingByName;

      if (target) {
        domainUpdates.push({
          id: target.id,
          inboxing_domain_id: inboxingDomainId,
          source: 'inboxing',
          status: remote.status ?? undefined,
          modified_on: remote.updated_at ?? now,
          last_synced: now,
        });
      } else {
        domainInserts.push({
          cloudflare_id: `inboxing-${remote.id}`,
          name: remote.domain_name,
          status: remote.status ?? 'pending',
          paused: false,
          type: 'inboxing',
          created_on: remote.created_at ?? now,
          modified_on: remote.updated_at ?? now,
          last_synced: now,
          source: 'inboxing',
          inboxing_domain_id: inboxingDomainId,
        });
      }
    });

    for (const chunk of chunkArray(domainInserts, CHUNK_SIZE)) {
      const { error } = await supabase.from('domains').insert(chunk);
      if (error) {
        throw error;
      }
    }

    for (const chunk of chunkArray(domainUpdates, CHUNK_SIZE)) {
      const { error } = await supabase.from('domains').upsert(chunk, { onConflict: 'id' });
      if (error) {
        throw error;
      }
    }

    await finishSync({
      status: 'completed',
      total_domains: remoteDomains.length,
      upserted_domains: inboxingUpsertPayload.length,
      disabled_domains: toDisable.length,
    });

    return NextResponse.json({
      message: `Synced ${remoteDomains.length} Inboxing domains`,
      summary: {
        total_remote: remoteDomains.length,
        upserted: inboxingUpsertPayload.length,
        disabled: toDisable.length,
        domains_inserted: domainInserts.length,
        domains_updated: domainUpdates.length,
      },
    });
  } catch (error) {
    console.error('[Inboxing sync] Failed:', error);
    await finishSync({
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    const message = error instanceof Error ? error.message : 'Failed to sync Inboxing domains';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

