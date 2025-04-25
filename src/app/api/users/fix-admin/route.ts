import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase admin client with service role
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zfwaqmkqqykfptczwqwo.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2FxbWtxcXlrZnB0Y3p3cXdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTQxMjQ0NiwiZXhwIjoyMDYwOTg4NDQ2fQ._b4muH3igc6CwPxTp7uPM54FWSCZkK1maSSbF7dAlQM',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Regular supabase client for auth operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zfwaqmkqqykfptczwqwo.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2FxbWtxcXlrZnB0Y3p3cXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTI0NDYsImV4cCI6MjA2MDk4ODQ0Nn0.cXzZsBxBe1j-lHQUccGLVbHdWxqS-TJ447DJlf7NL2E'
);

// API endpoint to fix admin user permissions
export async function POST(request: Request) {
  try {
    // Get the email from the request
    const { email } = await request.json();

    // Ensure it's the admin email
    if (email !== 'management@superwave.ai') {
      return NextResponse.json(
        { success: false, error: 'Only the management@superwave.ai account can be fixed by this endpoint' },
        { status: 403 }
      );
    }

    console.log(`[Fix Admin API] Fixing admin status for ${email}`);

    // Get current user session to verify they're authenticated
    const { data: sessionData } = await supabase.auth.getSession();
    
    // This is not required, but good for logging
    if (sessionData.session) {
      console.log(`[Fix Admin API] Current user email: ${sessionData.session.user.email}`);
    } else {
      console.log(`[Fix Admin API] No active session`);
    }

    // Find user by email
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('[Fix Admin API] Error listing users:', listError);
      return NextResponse.json(
        { success: false, error: 'Failed to list users' },
        { status: 500 }
      );
    }
    
    const adminUser = users.users.find(user => user.email === email);
    
    if (!adminUser) {
      console.error('[Fix Admin API] Admin user not found');
      return NextResponse.json(
        { success: false, error: 'Admin user not found' },
        { status: 404 }
      );
    }
    
    console.log(`[Fix Admin API] Found admin user: ${adminUser.id}`);
    console.log(`[Fix Admin API] Current metadata:`, adminUser.user_metadata);

    // Update the admin user's metadata
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      adminUser.id,
      {
        user_metadata: {
          role: 'admin',
          name: 'Administrator',
          is_admin: true
        },
        app_metadata: {
          role: 'admin'
        }
      }
    );
    
    if (updateError) {
      console.error('[Fix Admin API] Error updating user:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update admin user' },
        { status: 500 }
      );
    }
    
    console.log(`[Fix Admin API] User updated successfully`);
    
    return NextResponse.json({
      success: true,
      message: 'Admin role applied successfully. Please refresh the page.',
      user: {
        id: updatedUser.user.id,
        email: updatedUser.user.email,
        role: updatedUser.user.user_metadata?.role
      }
    });
    
  } catch (error) {
    console.error('[Fix Admin API] Error in fix-admin API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}