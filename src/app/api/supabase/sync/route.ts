import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase client with admin privileges
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

// Force sync of admin user in Supabase
export async function POST() { // Remove unused 'request' parameter
  try {
    // Verify current user is authenticated
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zfwaqmkqqykfptczwqwo.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2FxbWtxcXlrZnB0Y3p3cXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTI0NDYsImV4cCI6MjA2MDk4ODQ0Nn0.cXzZsBxBe1j-lHQUccGLVbHdWxqS-TJ447DJlf7NL2E'
    );
    
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const email = sessionData.session.user.email;
    
    // Check if this is the admin email
    if (email !== 'management@superwave.ai') {
      return NextResponse.json(
        { success: false, error: 'Only the management@superwave.ai account can perform this action' },
        { status: 403 }
      );
    }

    console.log(`[Admin Sync] Ensuring admin rights for user ${email}`);

    // Find the user by email
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return NextResponse.json(
        { success: false, error: 'Failed to list users' },
        { status: 500 }
      );
    }
    
    const adminUser = users.users.find(user => user.email === email);
    
    if (!adminUser) {
      return NextResponse.json(
        { success: false, error: 'Admin user not found' },
        { status: 404 }
      );
    }
    
    console.log(`[Admin Sync] Found admin user with ID ${adminUser.id}, current metadata:`, adminUser.user_metadata);

    // Update the user with admin role
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      adminUser.id,
      {
        user_metadata: {
          ...adminUser.user_metadata,
          role: 'admin',
          name: 'Administrator',
          is_admin: true
        }
      }
    );
    
    if (updateError) {
      console.error('Error updating user:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update user' },
        { status: 500 }
      );
    }
    
    console.log(`[Admin Sync] User updated successfully, new metadata:`, updatedUser.user.user_metadata);
    
    // Also clear any cached session data
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    
    if (signOutError) {
      console.warn('Could not sign out user locally:', signOutError);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Admin rights synced successfully. Please sign in again to refresh your session.',
      needsRefresh: true
    });
    
  } catch (error) {
    console.error('Error in admin sync API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}