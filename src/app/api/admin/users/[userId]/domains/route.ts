import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function GET(
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

    // First get the user's email
    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (userError || !targetUser) {
      console.error('Error getting user profile:', userError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get domains assigned to this user by email
    const { data: domainAssignments, error: assignmentsError } = await supabaseAdmin
      .from('domain_assignments')
      .select(`
        domain_id,
        assigned_at,
        domains (
          id,
          name,
          status,
          created_on,
          redirect_url,
          deployment_status,
          has_files
        )
      `)
      .eq('user_email', targetUser.email);

    // Also get domains directly owned by user_id
    const { data: ownedDomains, error: ownedError } = await supabaseAdmin
      .from('domains')
      .select('*')
      .eq('user_id', userId);

    if (assignmentsError && ownedError) {
      console.error('Error fetching user domains:', { assignmentsError, ownedError });
      return NextResponse.json(
        { error: 'Failed to fetch user domains' },
        { status: 500 }
      );
    }

    // Combine assigned domains and owned domains
    const assignedDomains = domainAssignments?.map(assignment => ({
      ...assignment.domains,
      assigned_at: assignment.assigned_at,
      ownership_type: 'assigned'
    })) || [];

    const directDomains = ownedDomains?.map(domain => ({
      ...domain,
      ownership_type: 'owned'
    })) || [];

    // Remove duplicates and combine
    const allDomains = [...assignedDomains, ...directDomains];
    const uniqueDomains = allDomains.filter((domain, index, self) => 
      index === self.findIndex(d => d.id === domain.id)
    );

    return NextResponse.json({
      success: true,
      domains: uniqueDomains,
      total_domains: uniqueDomains.length
    });

  } catch (error) {
    console.error('Error fetching user domains:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
