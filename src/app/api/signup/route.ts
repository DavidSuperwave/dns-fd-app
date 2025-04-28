// src/app/api/signup/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-client'; // Import the admin client

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    console.error('[API Signup] Supabase admin client is not initialized. Check SUPABASE_SERVICE_ROLE_KEY.');
    return NextResponse.json({ error: 'Server configuration error: Admin client not available.' }, { status: 500 });
  }

  let token: string | null = null;
  let email: string | null = null;
  let password: string | null = null;

  try {
    const body = await request.json();
    token = body.token;
    email = body.email;
    password = body.password;

    if (!token || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields: token, email, password' }, { status: 400 });
    }

    // Optional: Add password strength validation here if needed

    console.log(`[API Signup] Attempting signup for email: ${email} with token: ${token}`);

    // --- Start of logic moved from handleCompleteSignup ---

    // Step 1: Verify invitation is still valid
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('token', token)
      .eq('email', email)
      .is('used_at', null) // Check if not used
      .maybeSingle(); // Use maybeSingle to handle not found gracefully

    if (inviteError) {
        console.error('[API Signup] Error verifying invitation:', inviteError);
        return NextResponse.json({ error: `Database error verifying invitation: ${inviteError.message}` }, { status: 500 });
    }
    if (!invitation) {
      console.warn(`[API Signup] Invalid or expired invitation for token: ${token}, email: ${email}`);
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 400 });
    }

    console.log(`[API Signup] Invitation verified for ${email}. Role: ${invitation.role}`);

    // Step 2: Create the auth user (bypassing email confirmation)
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        name: email.split('@')[0], // Default name from email prefix
        role: invitation.role // Assign role from invitation
      },
      email_confirm: true, // Mark email as confirmed since invitation was verified
      app_metadata: { provider: 'email' } // Standard metadata
    });

    if (createError) {
      console.error('[API Signup] admin.createUser failed:', createError);
      // Handle specific errors like "User already registered"
      if (createError.message.toLowerCase().includes('already registered')) {
          return NextResponse.json({ error: 'This email address is already registered.' }, { status: 409 }); // 409 Conflict
      }
      return NextResponse.json({ error: `Failed to create user: ${createError.message}` }, { status: 500 });
    }

    if (!createData?.user) {
      console.error('[API Signup] No user data returned from admin.createUser');
      return NextResponse.json({ error: 'Failed to create user account (no user data returned).' }, { status: 500 });
    }

    const userId = createData.user.id;
    console.log(`[API Signup] Auth user created successfully for ${email}, ID: ${userId}`);

    // Use a try/catch block for post-creation steps to allow cleanup
    try {
      // Step 3: Mark invitation as used *first*
      const { error: markUsedError } = await supabaseAdmin
        .from('invitations')
        .update({ used_at: new Date().toISOString() })
        .eq('token', token); // Match only by token should be sufficient and safer

      if (markUsedError) {
        console.error('[API Signup] Error marking invitation as used:', markUsedError);
        // Don't immediately throw, attempt profile creation but log this issue
      } else {
        console.log(`[API Signup] Invitation marked as used for token: ${token}`);
      }

      // Step 4: Create active user profile
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: userId,
          email: email,
          name: email.split('@')[0], // Consistent with auth metadata
          role: invitation.role,
          status: 'active', // Set status directly to active
          active: true,
          confirmed_at: new Date().toISOString() // Record confirmation time
        });

      if (profileError) {
        console.error('[API Signup] Profile creation failed:', profileError);
        // If profile creation fails, we MUST attempt to clean up the auth user
        throw profileError; // Throw to trigger the cleanup catch block
      }

      console.log(`[API Signup] User profile created successfully for ${email}, ID: ${userId}`);

      // --- End of logic moved from handleCompleteSignup ---

      // 5. Return success response
      return NextResponse.json({ success: true, message: 'Account created successfully.' }, { status: 201 }); // 201 Created

    } catch (postCreationError) {
      // Cleanup: Delete the auth user if profile creation or marking invitation failed
      console.error('[API Signup] Error during post-creation steps, attempting cleanup for auth user:', userId, postCreationError);
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        console.log(`[API Signup] Successfully cleaned up auth user ${userId}`);
      } catch (cleanupError) {
        console.error(`[API Signup] CRITICAL: Failed to cleanup auth user ${userId} after error:`, cleanupError);
        // Log this critical failure, but return the original error message
      }
      const errorMessage = postCreationError instanceof Error ? postCreationError.message : 'Failed to finalize account setup.';
      return NextResponse.json({ error: `Account setup failed: ${errorMessage}` }, { status: 500 });
    }

  } catch (error) {
    console.error('[API Signup] General Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    // Avoid sending detailed internal errors to the client unless necessary
    return NextResponse.json({ error: 'An unexpected error occurred during signup.' }, { status: 500 });
  }
}