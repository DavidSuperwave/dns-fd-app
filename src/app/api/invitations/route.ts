import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../lib/supabase-admin';

type InvitationData = {
  email: string;
  role: 'admin' | 'user' | 'guest';
};

export async function POST(request: Request) {
  try {
    let supabaseAdmin;
    try {
      supabaseAdmin = createAdminClient();
    } catch (error) {
      console.error('[Invitation API] Failed to create Supabase Admin client:', error);
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const invitationData: InvitationData = await request.json();
    const { email, role } = invitationData;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    console.log(`[Invitation API] Creating invitation for ${email} with role ${role}`);

    try {
      // Check if user already exists
      const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
      if ((existingUser.users as { email: string }[]).some(u => u.email === email)) {
        return NextResponse.json(
          { success: false, error: 'User already exists' },
          { status: 400 }
        );
      }

      // Generate token for tracking
      const token = crypto.randomUUID();

      // Use Supabase's built-in invite system
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        {
          data: {
            role: role,
            invitation_token: token
          },
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`
        }
      );

      if (inviteError) {
        console.error('[Invitation API] Supabase invite error:', inviteError);
        throw inviteError;
      }

      console.log('[Invitation API] Supabase invitation sent successfully');

      // Store invitation record in our table for tracking
      const { error: dbError } = await supabaseAdmin
        .from('invitations')
        .insert({
          email,
          role,
          token,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        });

      if (dbError) {
        console.warn('[Invitation API] Failed to store invitation record:', dbError);
      }

      return NextResponse.json({
        success: true,
        message: 'Invitation sent successfully',
        user: inviteData.user,
        token: token
      });
    } catch (error) {
      console.error('Error sending invitation:', error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send invitation'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing invitation request:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process invitation'
      },
      { status: 500 }
    );
  }
}

// Get all invitations (for admin purposes)
export async function GET() {
  try {
    let supabaseAdmin;
    try {
      supabaseAdmin = createAdminClient();
    } catch (error) {
      console.error('[Invitation API GET] Failed to create Supabase Admin client:', error);
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    console.log('[Invitation API GET] Fetching invitations from database');

    const { data, error } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Invitation API GET] Database error:', error);

      if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        console.warn('[Invitation API GET] Invitations table does not exist yet.');
        return NextResponse.json({
          success: true,
          invitations: [],
          warning: 'Invitations table not created yet.'
        });
      }

      throw error;
    }

    console.log(`[Invitation API GET] Retrieved ${data?.length || 0} invitations`);

    return NextResponse.json({
      success: true,
      invitations: data || []
    });
  } catch (error) {
    console.error('[Invitation API GET] Error fetching invitations:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch invitations'
      },
      { status: 500 }
    );
  }
}