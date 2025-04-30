import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { sendPasswordResetEmail } from '@/lib/azure-email';

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
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

    // Find user without revealing existence
    const { data: userData, error: userError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('email', email)
      .single();

    const user = userData || null;
    
    if (userError || !user) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists, a reset link will be sent.'
      });
    }

    // Generate reset token
    const resetToken = randomBytes(32).toString('hex');

    // Store token in database (assuming you've created the password_resets table)
    const { error: insertError } = await supabaseAdmin
      .from('password_resets')
      .insert({
        user_id: user.id,
        token: resetToken,
        expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour expiry
      });

    if (insertError) {
      console.error('[Reset Password] Error storing reset token:', insertError);
      throw insertError;
    }

    // Send password reset email
    const { success, error: emailError } = await sendPasswordResetEmail(email, resetToken);

    if (!success || emailError) {
      console.error('[Reset Password] Error sending email:', emailError);
      throw new Error(emailError || 'Failed to send reset email');
    }

    return NextResponse.json({
      success: true,
      message: 'If your email is registered, you will receive reset instructions.'
    });

  } catch (error) {
    console.error('[Reset Password] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}