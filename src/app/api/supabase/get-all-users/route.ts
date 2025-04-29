import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr'; // Use createServerClient from @supabase/ssr
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-client'; // Import the admin client
import { UserProfile } from '@/lib/supabase-client'; // Import the UserProfile type

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  // Await the cookies() promise to get the resolved store
  const resolvedCookieStore = await cookies();

  // Create Supabase client configured for Route Handlers
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Define cookie methods using the RESOLVED store instance
        get(name: string) {
          return resolvedCookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            resolvedCookieStore.set({ name, value, ...options });
          } catch (error) {
            // Ignore errors from Server Components
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            resolvedCookieStore.delete({ name, ...options });
          } catch (error) {
            // Ignore errors from Server Components
          }
        },
      },
    }
  );

  try {
    // 1. Verify user is authenticated using the ssr client
    // getUser automatically handles session refresh if needed
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.warn('[API Get All Users] Authentication failed:', userError?.message || 'No user found.');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // 2. Verify user is admin (using the verified user object)
    // Check email directly and user_metadata for role
    const isAdmin = user.email === process.env.ADMIN_EMAIL || user.user_metadata?.role === 'admin';

    if (!isAdmin) {
      console.warn(`[API Get All Users] Forbidden attempt by non-admin: ${user.email}`);
      return NextResponse.json({ error: 'Forbidden: Requires admin privileges' }, { status: 403 });
    }

    console.log(`[API Get All Users] Admin user authenticated: ${user.email}`);
    // console.warn('[API Get All Users] !!! AUTHENTICATION CHECK TEMPORARILY DISABLED !!!'); // Removed warning

    // 3. Fetch all profiles using the supabaseAdmin client (service role)
    if (!supabaseAdmin) {
      console.error('[API Get All Users] Supabase admin client is not initialized.');
      return NextResponse.json({ error: 'Internal Server Error: Admin client unavailable' }, { status: 500 });
    }

    const { data: profilesData, error: profilesError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('[API Get All Users] Error fetching profiles with admin client:', profilesError);
      // Don't throw the raw error, return a generic server error
      return NextResponse.json({ error: 'Database error fetching profiles' }, { status: 500 });
    }

    console.log(`[API Get All Users] Successfully fetched ${profilesData?.length || 0} profiles.`);
    // Ensure the response is always an array, even if null/empty
    return NextResponse.json((profilesData as UserProfile[] | null) || []);

  } catch (error) {
    console.error('[API Get All Users] General Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    // Consider logging the full error server-side but return a generic message
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}