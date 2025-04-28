import { NextResponse, type NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-client'; // Import the admin client
import { UserProfile } from '@/lib/supabase-client'; // Import the UserProfile type

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  const cookieStore = cookies();
  // Use createRouteHandlerClient for checking user auth within route handlers
  const supabaseRouteClient = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    // 1. Verify user is authenticated
    const { data: { session }, error: sessionError } = await supabaseRouteClient.auth.getSession();
    if (sessionError || !session) {
      console.warn('[API Get All Users] No session found.');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // 2. Verify user is admin
    const user = session.user;
    const isAdmin = user?.email === 'management@superwave.ai' || user?.user_metadata?.role === 'admin';

    if (!isAdmin) {
      console.warn(`[API Get All Users] Non-admin user attempt: ${user?.email}`);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log(`[API Get All Users] Admin user authenticated: ${user.email}`);

    // 3. Fetch all profiles using the supabaseAdmin client (service role)
    if (!supabaseAdmin) {
      console.error('[API Get All Users] Supabase admin client is not initialized.');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    const { data: profilesData, error: profilesError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('[API Get All Users] Error fetching profiles with admin client:', profilesError);
      throw profilesError; // Let the catch block handle it
    }

    console.log(`[API Get All Users] Successfully fetched ${profilesData?.length || 0} profiles.`);
    return NextResponse.json((profilesData as UserProfile[] | null) || []);

  } catch (error) {
    console.error('[API Get All Users] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    // Check for specific Supabase error codes if needed
    // Check if error is an object and has a 'code' property before accessing it
    const isSupabaseError = typeof error === 'object' && error !== null && 'code' in error;
    const errorCode = isSupabaseError ? (error as { code: string }).code : undefined;
    const status = errorCode === '42501' ? 403 : 500; // Example: return 403 on permission denied
    return NextResponse.json({ error: errorMessage }, { status });
  }
}