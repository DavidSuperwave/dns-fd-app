import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Verify admin access
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          async get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if user is admin
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabaseAdmin = createAdminClient();
    const { userId } = await params;

    // Don't allow deleting yourself
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Get user info before deletion
    const { data: userToDelete, error: getUserError } = await supabaseAdmin
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (getUserError) {
      console.error('Error getting user to delete:', getUserError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete from user_profiles first (this will cascade to other tables if properly configured)
    const { error: deleteProfileError } = await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('id', userId);

    if (deleteProfileError) {
      console.error('Error deleting user profile:', deleteProfileError);
      return NextResponse.json(
        { error: 'Failed to delete user profile' },
        { status: 500 }
      );
    }

    // Clean up related data
    await Promise.allSettled([
      // Delete domain assignments
      supabaseAdmin
        .from('domain_assignments')
        .delete()
        .eq('user_email', userToDelete.email),
      
      // Delete billing plans
      supabaseAdmin
        .from('billing_plans')
        .delete()
        .eq('user_id', userId),
      
      // Delete invitations
      supabaseAdmin
        .from('invitations')
        .delete()
        .eq('invited_by', userId),
    ]);

    // Delete the auth user (this is the most critical step)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      // Note: We've already deleted the profile, so this is a partial failure
      return NextResponse.json(
        { 
          success: true, 
          warning: 'User profile deleted but auth user deletion failed',
          message: 'User deleted successfully'
        }
      );
    }

    return NextResponse.json({
      success: true,
      message: `User ${userToDelete.email} deleted successfully`
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
