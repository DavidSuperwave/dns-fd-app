import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize admin client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const { userId, email } = await request.json();

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'User ID and email are required' },
        { status: 400 }
      );
    }

    console.log(`[API] Confirming email for user ${email}`);

    // Update user's email_confirmed_at using admin API
    const { error: updateError } = await adminSupabase.auth.admin.updateUserById(
      userId,
      { email_confirmed_at: new Date().toISOString() }
    );

    if (updateError) {
      console.error('[API] Error confirming user email:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Update user profile status
    const { error: profileError } = await adminSupabase
      .from('user_profiles')
      .update({ 
        status: 'active',
        confirmed_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileError) {
      console.error('[API] Error updating profile status:', profileError);
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    console.log(`[API] Successfully confirmed email for ${email}`);

    return NextResponse.json({
      success: true,
      message: 'User email confirmed successfully'
    });

  } catch (error) {
    console.error('[API] Error in confirm-user:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}