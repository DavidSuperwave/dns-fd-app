import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-client'; // Import the admin client

export const dynamic = 'force-dynamic';

// DELETE handler for deleting a user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userIdToDelete = (await params).id;
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
        // Define set/remove for completeness, though not strictly needed for getUser
        set(name: string, value: string, options: CookieOptions) {
          try {
             resolvedCookieStore.set({ name, value, ...options });
          } catch (error) {
             console.warn(`[API User Delete] Failed to set cookie '${name}' via Route Handler.`, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            resolvedCookieStore.set({ name, value: '', ...options });
          } catch (error) {
            console.warn(`[API User Delete] Failed to remove cookie '${name}' via Route Handler.`, error);
          }
        },
      },
    }
  );

  try {
    // 1. Verify requesting user is authenticated and is an admin
    const { data: { user: requestingUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !requestingUser) {
      console.warn('[API User Delete] Authentication failed.', authError);
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if the requesting user is an admin (using role from metadata OR specific email if needed)
    // Ensure ADMIN_EMAIL is set in your environment variables if using that check
    const isAdmin = requestingUser?.user_metadata?.role === 'admin' || requestingUser?.email === process.env.ADMIN_EMAIL;
    if (!isAdmin) {
      console.warn(`[API User Delete] Forbidden attempt by non-admin: ${requestingUser.email}`);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Prevent admin from deleting themselves (optional but good practice)
    if (requestingUser.id === userIdToDelete) {
        console.warn(`[API User Delete] Admin ${requestingUser.email} attempted to delete themselves.`);
        return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    console.log(`[API User Delete] Admin ${requestingUser.email} attempting to delete user ID: ${userIdToDelete}`);

    // 2. Perform deletion using the admin client
    // Attempt to delete the Auth user first.
    if (!supabaseAdmin) {
      console.error('[API User Delete] Supabase admin client is not initialized. Check SUPABASE_SERVICE_ROLE_KEY.');
      return NextResponse.json({ error: 'Server configuration error: Admin client not available.' }, { status: 500 });
    }
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userIdToDelete);

    if (authDeleteError) {
        // Handle case where user might not exist in Auth already but profile might
        if (authDeleteError.message.toLowerCase().includes('user not found')) {
            console.warn(`[API User Delete] User ${userIdToDelete} not found in Auth, proceeding to delete profile.`);
        } else {
            // For other auth deletion errors, log it but still attempt profile deletion
            console.error(`[API User Delete] Error deleting auth user ${userIdToDelete}:`, authDeleteError);
        }
    } else {
        console.log(`[API User Delete] Successfully deleted auth user ${userIdToDelete}.`);
    }

    // Delete User Profile (attempt this regardless of auth deletion outcome to ensure cleanup)
    // No need to re-check supabaseAdmin here if the first check passed, but added for clarity/safety
    if (!supabaseAdmin) {
       console.error('[API User Delete] Supabase admin client is not initialized before profile delete. Check SUPABASE_SERVICE_ROLE_KEY.');
       return NextResponse.json({ error: 'Server configuration error: Admin client not available.' }, { status: 500 });
    }
    const { error: profileDeleteError } = await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('id', userIdToDelete);

    if (profileDeleteError) {
      // If profile deletion fails, this is a more significant issue.
      console.error(`[API User Delete] Error deleting profile for user ${userIdToDelete}:`, profileDeleteError);
      // Return error even if auth deletion succeeded or failed with "not found"
       return NextResponse.json({ error: `Failed to delete user profile for ${userIdToDelete}. Auth deletion status: ${authDeleteError ? authDeleteError.message : 'Success'}` }, { status: 500 });
    } else {
        console.log(`[API User Delete] Successfully deleted profile for user ${userIdToDelete}.`);
    }

    // If profile deletion succeeded, but auth deletion failed with a real error (not "not found")
    if (authDeleteError && !authDeleteError.message.toLowerCase().includes('user not found')) {
         return NextResponse.json({ error: `Auth user deletion failed: ${authDeleteError.message}. Profile was deleted.` }, { status: 500 });
    }

    // 3. Return success response (implies profile deleted, and auth user either deleted or was already gone)
    return NextResponse.json({ success: true, message: `User ${userIdToDelete} deleted successfully.` }, { status: 200 });

  } catch (error) {
    console.error('[API User Delete] General Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
// PATCH handler for toggling user active status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userIdToUpdate = (await params).id;
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
             console.warn(`[API User Status Toggle] Failed to set cookie '${name}' via Route Handler.`, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            resolvedCookieStore.set({ name, value: '', ...options });
          } catch (error) {
            console.warn(`[API User Status Toggle] Failed to remove cookie '${name}' via Route Handler.`, error);
          }
        },
      },
    }
  );

  try {
    // 1. Verify requesting user is authenticated and is an admin
    const { data: { user: requestingUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !requestingUser) {
      console.warn('[API User Status Toggle] Authentication failed.', authError);
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const isAdmin = requestingUser?.user_metadata?.role === 'admin' || requestingUser?.email === process.env.ADMIN_EMAIL;
    if (!isAdmin) {
      console.warn(`[API User Status Toggle] Forbidden attempt by non-admin: ${requestingUser.email}`);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Get the new active status from the request body
    let active: boolean;
    try {
      const body = await request.json();
      if (typeof body.active !== 'boolean') {
        return NextResponse.json({ error: 'Invalid request body: "active" must be a boolean.' }, { status: 400 });
      }
      active = body.active;
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
    }

    // Prevent admin from deactivating themselves
    if (requestingUser.id === userIdToUpdate && !active) {
        console.warn(`[API User Status Toggle] Admin ${requestingUser.email} attempted to deactivate themselves.`);
        return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 });
    }

    console.log(`[API User Status Toggle] Admin ${requestingUser.email} attempting to set user ID ${userIdToUpdate} active status to: ${active}`);

    // 3. Update the user profile using the admin client
    // Note: We only update the 'user_profiles' table here. Supabase Auth doesn't have a direct 'active' flag.
    // User access control should primarily rely on the 'user_profiles' table status or roles.
    if (!supabaseAdmin) {
      console.error('[API User Status Toggle] Supabase admin client is not initialized. Check SUPABASE_SERVICE_ROLE_KEY.');
      return NextResponse.json({ error: 'Server configuration error: Admin client not available.' }, { status: 500 });
    }
    const { error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update({ active: active }) // Update the 'active' column
      .eq('id', userIdToUpdate);

    if (updateError) {
      console.error(`[API User Status Toggle] Error updating profile for user ${userIdToUpdate}:`, updateError);
      return NextResponse.json({ error: `Failed to update user status: ${updateError.message}` }, { status: 500 });
    }

    console.log(`[API User Status Toggle] Successfully updated active status for user ${userIdToUpdate} to ${active}.`);

    // 4. Return success response
    return NextResponse.json({ success: true, active: active }, { status: 200 });

  } catch (error) {
    console.error('[API User Status Toggle] General Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}