import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { getSupabaseAdminClient } from '@/lib/supabase-client';

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
            console.warn('[user-domain-slots] Failed to set cookie', name, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            console.warn('[user-domain-slots] Failed to remove cookie', name, error);
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

  const isAdmin = user.user_metadata?.role === 'admin' || user.email === process.env.ADMIN_EMAIL;
  if (!isAdmin) {
    return { status: 403, body: { error: 'Forbidden' } as const };
  }

  return { status: 200, user };
}

export async function GET(request: NextRequest) {
  const authResult = await assertAdmin(request);
  if (authResult.status !== 200) {
    return NextResponse.json(authResult.body, { status: authResult.status });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 });
  }

  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 500);

  let query = supabase.from('user_domain_slots').select('*').order('updated_at', { ascending: false }).limit(limit);

  if (email) {
    query = query.ilike('user_email', `%${email.trim()}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[GET /api/user-domain-slots] Query failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ slots: data ?? [] });
}

export async function POST(request: NextRequest) {
  const authResult = await assertAdmin(request);
  if (authResult.status !== 200) {
    return NextResponse.json(authResult.body, { status: authResult.status });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 });
  }

  const body = await request.json();

  const user_email: string | undefined = body.user_email;
  if (!user_email) {
    return NextResponse.json({ error: 'user_email is required' }, { status: 400 });
  }

  const total_slots = Number(body.total_slots ?? 0);
  const used_slots = Number(body.used_slots ?? 0);
  const pending_slots = Number(body.pending_slots ?? 0);

  if (total_slots < 0 || used_slots < 0 || pending_slots < 0) {
    return NextResponse.json({ error: 'Slot counts must be non-negative' }, { status: 400 });
  }

  if (used_slots > total_slots) {
    return NextResponse.json({ error: 'used_slots cannot exceed total_slots' }, { status: 400 });
  }

  const { data: userProfile, error: userProfileError } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', user_email)
    .maybeSingle();

  if (userProfileError) {
    console.error('[POST /api/user-domain-slots] Failed to lookup user profile:', userProfileError);
    return NextResponse.json({ error: 'Failed to look up user profile' }, { status: 500 });
  }

  const payload = {
    user_email,
    user_id: userProfile?.id ?? null,
    total_slots,
    used_slots,
    pending_slots,
    source: body.source || 'manual',
    notes: body.notes || null,
    metadata: body.metadata || {},
  };

  const { data, error } = await supabase
    .from('user_domain_slots')
    .upsert(payload, { onConflict: 'user_email' })
    .select()
    .single();

  if (error) {
    console.error('[POST /api/user-domain-slots] Upsert failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ slot: data });
}

