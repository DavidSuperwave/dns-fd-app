import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr'; // Import from @supabase/ssr
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-client'; // Import the admin client

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const cookieStore = cookies();

  // Create Supabase client using createServerClient (from @supabase/ssr)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // Use the cookieStore directly (it's not a promise here)
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // API Routes usually don't set request cookies, but implement if needed for response
          // For now, this primarily needs 'get'
          // cookieStore.set({ name, value, ...options }); // This would error as cookieStore is Readonly
          console.warn(`[API Refresh Status] Attempted to set cookie '${name}' in API route (usually read-only).`);
        },
        remove(name: string, options: CookieOptions) {
          // API Routes usually don't remove request cookies
          // cookieStore.set({ name, value: '', ...options }); // This would error as cookieStore is Readonly
           console.warn(`[API Refresh Status] Attempted to remove cookie '${name}' in API route (usually read-only).`);
        },
      },
    }
  );

  try {
    // 1. Verify requesting user is authenticated and is an admin using getUser()
    const { data: { user: requestingUser }, error: userError } = await supabase.auth.getUser(); // Use the new client

    if (userError || !requestingUser) {
      console.warn('[API Refresh Status] No authenticated user found via getUser() with ssr client.', userError);
      // Log the specific cookie value if possible for debugging (BE CAREFUL WITH SENSITIVE DATA)
      // console.log('Auth token cookie value:', cookieStore.get('sb-zfwaqmkqqykfptczwqwo-auth-token')?.value);
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // User is authenticated, now check if admin
    const isAdmin = requestingUser?.email === 'management@superwave.ai' || requestingUser?.user_metadata?.role === 'admin';

    if (!isAdmin) {
      console.warn(`[API Refresh Status] Non-admin user attempt: ${requestingUser?.email}`);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Get userId from request body
    const { userId } = await request.json();
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Invalid userId provided' }, { status: 400 });
    }

    console.log(`[API Refresh Status] Admin ${requestingUser.email} attempting to refresh status for user ID: ${userId}`);

    // 3. Fetch user details from Supabase Auth using admin client
    const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (authUserError) {
      console.error(`[API Refresh Status] Error fetching user ${userId} from Auth:`, authUserError);
      if (authUserError.message.includes('User not found')) {
         await supabaseAdmin
           .from('user_profiles')
           .update({ status: 'unknown' })
           .eq('id', userId);
         return NextResponse.json({ error: 'User not found in Auth system.' }, { status: 404 });
      }
      throw authUserError;
    }

    const authUser = authUserData.user;
    if (!authUser) {
       console.warn(`[API Refresh Status] User ${userId} not found in Auth system (data was null).`);
       await supabaseAdmin
         .from('user_profiles')
         .update({ status: 'unknown' })
         .eq('id', userId);
       return NextResponse.json({ error: 'User not found in Auth system.' }, { status: 404 });
    }

    // 4. Determine the correct status based on Auth data
    const newStatus = (authUser.email_confirmed_at || authUser.last_sign_in_at) ? 'active' : 'pending';

    console.log(`[API Refresh Status] Determined status for ${authUser.email} (ID: ${userId}): ${newStatus}`);

    // 5. Update the status in the user_profiles table
    const { error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update({ status: newStatus })
      .eq('id', userId);

    if (updateError) {
      console.error(`[API Refresh Status] Error updating profile for user ${userId}:`, updateError);
      throw updateError;
    }

    console.log(`[API Refresh Status] Successfully updated profile status for user ${userId} to ${newStatus}`);

    // 6. Return the new status
    return NextResponse.json({ success: true, newStatus: newStatus });

  } catch (error) {
    console.error('[API Refresh Status] General Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    const hasStatus = typeof error === 'object' && error !== null && 'status' in error && typeof (error as { status: unknown }).status === 'number';
    const status = hasStatus ? (error as { status: number }).status : 500;
    return NextResponse.json({ error: errorMessage }, { status });
  }
}