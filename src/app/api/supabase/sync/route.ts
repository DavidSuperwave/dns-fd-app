import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface SupabaseUser {
  id: string;
  email: string | null; 
  user_metadata: {
    role: string;
    name: string;
    is_admin: boolean;
  };
}

interface ListUsersResponse {
  users: SupabaseUser[];
}
// Supabase client with admin privileges
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zfwaqmkqqykfptczwqwo.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || (() => { throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined'); })(),
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
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (() => { throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined'); })(),
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
    if (email !== 'admin@superwave.io') {
      return NextResponse.json(
        { success: false, error: 'Only the admin@superwave.io account can perform this action' },
        { status: 403 }
      );
    }

    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();

  if (listError) {
    console.error('Error listing users:', listError);
    return NextResponse.json(
      { success: false, error: 'Failed to list users' },
      { status: 500 }
    );
  }

  // Type assertion to tell TypeScript that 'users' is an array of 'SupabaseUser' objects
  const adminUser = users.users.find(user => user.email && user.email === email);
    
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