import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { getSupabaseAdminClient } from '@/lib/supabase-client';

async function assertAdmin() {
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
            console.warn('[Inbox assign] Failed to set cookie', name, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            console.warn('[Inbox assign] Failed to remove cookie', name, error);
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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await assertAdmin();
  if (authResult.status !== 200) {
    return NextResponse.json(authResult.body, { status: authResult.status });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 });
  }

  const inboxingDomainId = Number(id);
  if (!inboxingDomainId || Number.isNaN(inboxingDomainId)) {
    return NextResponse.json({ error: 'Invalid Inboxing domain id' }, { status: 400 });
  }

  let body: { userEmail?: string | null } = {};
  try {
    body = await request.json();
  } catch (error) {
    console.warn('[Inbox assign] Failed to parse payload, defaulting to empty body', error);
  }

  const normalizedEmail = body.userEmail?.trim() || '';
  const userEmail = normalizedEmail.length > 0 ? normalizedEmail.toLowerCase() : null;

  let userId: string | null = null;
  if (userEmail) {
    const { data: userProfile, error: userProfileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', userEmail)
      .maybeSingle();

    if (userProfileError) {
      console.error('[Inbox assign] Failed to look up user profile:', userProfileError);
      return NextResponse.json({ error: 'Unable to look up user profile' }, { status: 500 });
    }

    if (!userProfile) {
      return NextResponse.json({ error: `User not found for email ${userEmail}` }, { status: 404 });
    }

    userId = userProfile.id;
  }

  const updatePayload = {
    user_email: userEmail,
    user_id: userId,
    assigned_at: userEmail ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from('inboxing_domains')
    .update(updatePayload)
    .eq('id', inboxingDomainId)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[Inbox assign] Failed to update Inboxing domain:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Inbox domain not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, domain: data });
}

