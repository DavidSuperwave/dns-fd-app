import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { password, token } = await request.json();

    if (!password || !token) {
      return NextResponse.json(
        { error: 'Password and token are required' },
        { status: 400 }
      );
    }

    // Update the password using the recovery token
    const { error: updateError } = await supabaseAdmin.auth.updateUser({
      password: password
    }, {
      // Pass the token from the reset password link
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http:localhost:3000"}/forgot-password/confirm`
    });

    if (updateError) {
      console.error('[Reset Password Confirm] Error updating password:', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Failed to update password' },
        { status: 500 }
      );
    }

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