import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL !,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Send password reset email directly without checking user existence
    // This is more secure as it doesn't reveal whether an email exists
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/forgot-password/confirm`,
    });

    if (error) {
      console.error('[Reset Password] Error:', error);
      return NextResponse.json(
        { error: 'Failed to send reset instructions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'If your email is registered, you will receive reset instructions.'
    });

  } catch (error) {
    console.error('[Reset Password] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}