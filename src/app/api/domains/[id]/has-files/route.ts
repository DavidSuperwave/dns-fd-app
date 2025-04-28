// src/app/api/domains/[id]/has-files/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-client';

export const dynamic = 'force-dynamic';

// PATCH handler for updating the has_files flag on a domain
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const domainIdToUpdate = (await params).id;
  const resolvedCookieStore = await cookies();

  // Create Supabase client for auth check
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return resolvedCookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          try { resolvedCookieStore.set({ name, value, ...options }) } catch (error) { console.warn(`[API HasFiles Update] Failed set cookie`, error) }
        },
        remove(name: string, options: CookieOptions) {
          try { resolvedCookieStore.set({ name, value: '', ...options }) } catch (error) { console.warn(`[API HasFiles Update] Failed remove cookie`, error) }
        },
      },
    }
  );

  try {
    // 1. Verify requesting user is authenticated and is an admin
    const { data: { user: requestingUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !requestingUser) {
      console.warn('[API HasFiles Update] Authentication failed.', authError);
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // For now, restrict this to admins. Could be expanded later to assigned users.
    const isAdmin = requestingUser?.user_metadata?.role === 'admin' || requestingUser?.email === process.env.ADMIN_EMAIL;
    if (!isAdmin) {
      console.warn(`[API HasFiles Update] Forbidden attempt by non-admin: ${requestingUser.email}`);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Get the new has_files status from the request body
    let hasFiles: boolean;
    try {
      const body = await request.json();
      if (typeof body.has_files !== 'boolean') {
        return NextResponse.json({ error: 'Invalid request body: "has_files" must be a boolean.' }, { status: 400 });
      }
      hasFiles = body.has_files;
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
    }

    // 3. Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      console.error('[API HasFiles Update] Supabase admin client is not initialized.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    console.log(`[API HasFiles Update] Admin ${requestingUser.email} attempting to set domain ID ${domainIdToUpdate} has_files status to: ${hasFiles}`);

    // 4. Update the domain record using the admin client
    const { error: updateError } = await supabaseAdmin
      .from('domains')
      .update({ has_files: hasFiles })
      .eq('id', domainIdToUpdate);

    if (updateError) {
      console.error(`[API HasFiles Update] Error updating domain ${domainIdToUpdate}:`, updateError);
      // Check for specific errors like "domain not found" if needed
      return NextResponse.json({ error: `Failed to update domain: ${updateError.message}` }, { status: 500 });
    }

    console.log(`[API HasFiles Update] Successfully updated has_files status for domain ${domainIdToUpdate} to ${hasFiles}.`);

    // 5. Return success response
    return NextResponse.json({ success: true, has_files: hasFiles }, { status: 200 });

  } catch (error) {
    console.error('[API HasFiles Update] General Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}