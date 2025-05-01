import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { email, password, token } = await request.json();

    if (!email || !password || !token) {
      return NextResponse.json(
        { error: 'Email, password, and token are required' },
        { status: 400 }
      );
    }

    // 1. Verify the token and email in password_resets table
    const { data: resetData, error: resetError } = await supabaseAdmin
      .from('password_resets')
      .select('*')
      .eq('email', email)
      .eq('token', token)
      .eq('used', false)
      .single();

    if (resetError || !resetData) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (new Date(resetData.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Reset token has expired' },
        { status: 400 }
      );
    }

    // 2. Find the user by email
    const { data: userData, error: userError } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 3. Update the user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userData.id, { password });

    if (updateError) {
      console.error('[Reset Password Confirm] Error updating password:', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Failed to update password' },
        { status: 500 }
      );
    }

    // 4. Mark the token as used
    await supabaseAdmin
      .from('password_resets')
      .update({ used: true })
      .eq('id', resetData.id);

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('[Reset Password Confirm] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}