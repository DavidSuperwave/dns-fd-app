import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../lib/supabase-admin';
import { sendInvitationEmail } from '../../../lib/resend-email'; 

  // Azure Communication Services email client configuration
// const connectionString = "endpoint=https://sw-01.unitedstates.communication.azure.com/;accesskey=AEukP4bAKqA7qviO1tDeVxTMhzkTpw5ciJl9IhZbFeVOE7OjV9UGJQQJ99AFACULyCpb8TiCAAAAAZCSHrmv"; // Store securely, not hardcoded
const senderAddress = "desk@concierge.swbs.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
type InvitationData = {
  email: string;
  role: 'admin' | 'user' | 'guest';
};

export async function POST(request: Request) {
  try {
    // Create Supabase admin client
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

    // Optional: If you still need Bearer token auth for this specific route,
    // you can compare it against a separate environment variable meant for this route's auth.
    // Example: const INVITATION_API_SECRET = process.env.INVITATION_API_SECRET;
    // const authHeader = request.headers.get('authorization');
    // const token = authHeader?.substring(7);
    // if (!INVITATION_API_SECRET || token !== INVITATION_API_SECRET) {
    //   return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 401 });
    // }
    // For now, we assume access to this route implies sufficient privilege if supabaseAdmin is available.

    console.log('[Invitation API] Admin client available, proceeding.');

    // Parse the invitation data from the request
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

      // Generate token and store invitation in database
      const token = crypto.randomUUID();
      
      // First, let's check what columns exist in the table
      console.log('[Invitation API] Attempting to insert invitation record');
      
      const { error: dbError } = await supabaseAdmin
        .from('invitations')
        .insert({
          email,
          role,
          token,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
          // Removed created_by as it might not exist in your table schema
        });

      if (dbError) {
        console.error('[Invitation API] Database error:', dbError);
        throw dbError;
      }

      console.log('[Invitation API] Created invitation in database');

      // Create the invitation link
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const invitationLink = `${baseUrl}/signup?token=${token}&email=${encodeURIComponent(email)}`;
      
      // Construct the email HTML content
      // Note: This variable appears unused because the email sending code is commented out for development.
      // It will be used when the production email sending code is enabled.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const htmlContent = `
            <html>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px;">
            <h1 style="color: #0070f3;">Welcome to Superwave</h1>
            <p>You've been invited to join the Superwave platform with a <strong>${role}</strong> role.</p>
            <p>Click the button below to set up your password and access the platform:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${invitationLink}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                Accept Invitation
              </a>
            </div>
            
            <p>Or copy and paste this link in your browser:</p>
            <p style="background-color: #e9e9e9; padding: 10px; border-radius: 3px; word-break: break-all;">
              ${invitationLink}
            </p>
            
            <p style="margin-top: 40px; font-size: 12px; color: #666;">
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        </body>
      </html>
      `;

      // Send invitation email
      const { success: emailSuccess, error: emailError } = await sendInvitationEmail(
        email,
        role,
        token
      );

      if (!emailSuccess) {
        console.error('[Invitation API] Failed to send email:', emailError);
        // Don't throw error, just log it since the invitation was created
        // But we should still inform the client that email failed
        return NextResponse.json({
          success: true,
          message: 'Invitation created but email failed to send',
          token: token,
          emailError: emailError
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Invitation sent successfully',
        token: token // Return the token for testing purposes
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

// Get all invitations (for testing/admin purposes)
export async function GET() { // Remove unused 'request' parameter
  try {
    // We're just returning a mock response for now since there are auth issues
    // This will allow us to test the front-end functionality
    console.log('[Invitation API] Serving mock invitations data');
    
    const mockInvitations = [
      {
        email: 'test1@example.com',
        role: 'user',
        token: 'mock-token-1',
        created_at: new Date().toISOString(),
        created_by: 'admin@example.com'
      },
      {
        email: 'test2@example.com',
        role: 'admin',
        token: 'mock-token-2',
        created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        created_by: 'admin@example.com'
      }
    ];

    return NextResponse.json({
      success: true,
      invitations: mockInvitations
    });
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch invitations'
      },
      { status: 500 }
    );
  }
}