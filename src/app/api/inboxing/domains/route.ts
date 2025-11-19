import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-client';

const MAX_PAGE_SIZE = 200;

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 });
  }

  try {
    const url = new URL(request.url);
    const page = Math.max(Number(url.searchParams.get('page')) || 1, 1);
    const perPageRaw = Number(url.searchParams.get('per_page')) || 50;
    const perPage = Math.min(Math.max(perPageRaw, 1), MAX_PAGE_SIZE);
    const includeInactive = url.searchParams.get('include_inactive') === 'true';
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');

    let query = supabase
      .from('inboxing_domains')
      .select('*', { count: 'exact' })
      .order('domain_name', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    if (status && status.trim().length > 0) {
      query = query.eq('status', status.trim());
    }

    if (search && search.trim().length > 0) {
      query = query.ilike('domain_name', `%${search.trim()}%`);
    }

    const start = (page - 1) * perPage;
    const end = start + perPage - 1;
    query = query.range(start, end);

    const [{ data: domains, error, count }, { data: lastSync, error: lastSyncError }] = await Promise.all([
      query,
      supabase
        .from('inboxing_sync_runs')
        .select('id, started_at, finished_at, status, upserted_domains, disabled_domains')
        .order('finished_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (error) {
      console.error('[GET /api/inboxing/domains] Supabase query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (lastSyncError) {
      console.warn('[GET /api/inboxing/domains] Failed to fetch last sync metadata:', lastSyncError);
    }

    const total = typeof count === 'number' ? count : domains?.length || 0;
    const totalPages = Math.max(Math.ceil(total / perPage), 1);

    return NextResponse.json({
      domains: domains ?? [],
      pagination: {
        page,
        per_page: perPage,
        total,
        pages: totalPages,
        has_prev: page > 1,
        has_next: page < totalPages,
        prev_num: page > 1 ? page - 1 : null,
        next_num: page < totalPages ? page + 1 : null,
      },
      last_sync: lastSync?.finished_at ?? lastSync?.started_at ?? null,
      last_sync_status: lastSync?.status ?? null,
      last_sync_counts: lastSync
        ? {
            upserted: lastSync.upserted_domains ?? 0,
            disabled: lastSync.disabled_domains ?? 0,
          }
        : null,
    });
  } catch (error) {
    console.error('[GET /api/inboxing/domains] Unexpected failure:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error fetching Inboxing domains';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

