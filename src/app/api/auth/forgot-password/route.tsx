import { NextResponse } from 'next/server';
import { sendPasswordResetEmail } from '../../../../lib/azure-email';
import { supabaseAdmin } from '@/lib/supabase-client';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const token = crypto.randomUUID();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetLink = `${baseUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
    console.log(resetLink);
    // Save the token before sending the email
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour expiry
    if (!supabaseAdmin) {
      console.error('[Forgot Password] Supabase client is not initialized');
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

    const { error: dbError } = await supabaseAdmin
      .from('password_resets')
      .insert([
        {
          email,
          token,
          expires_at: expiresAt.toISOString(),
          used: false
        }
      ]);
    if (dbError) {
      console.error('[Forgot Password] Failed to save reset token:', dbError);
      return NextResponse.json(
        { error: 'Failed to initiate password reset' },
        { status: 500 }
      );
    }

    const { success: emailSuccess, error: emailError } = await sendPasswordResetEmail(
      email,
      resetLink
    );

    if (!emailSuccess) {
      console.error('[Forgot Password] Failed to send email:', emailError);
      // Delete the token since the email was not sent
      await supabaseAdmin
        .from('password_resets')
        .delete()
        .eq('token', token);
    }

    return NextResponse.json({
      success: true,
      message: 'If your email is registered, you will receive reset instructions.'
    });
  } catch (error) {
    console.error('Error sending reset link:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send Reset Link'
      },
      { status: 500 }
    );
  }
}