import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const resolvedCookieStore = await cookies();

  // Create Supabase client for auth check
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return resolvedCookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            resolvedCookieStore.set({ name, value, ...options });
          } catch (error) {
            console.warn(`[API Users] Failed to set cookie '${name}' via Route Handler.`, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            resolvedCookieStore.set({ name, value: '', ...options });
          } catch (error) {
            console.warn(`[API Users] Failed to remove cookie '${name}' via Route Handler.`, error);
          }
        },
      },
    }
  );

  try {
    console.log('[API Users] Processing request...');
    
    // 1. Verify requesting user is authenticated and is an admin
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    console.log('[API Users] Session check:', { 
      hasSession: !!session, 
      hasUser: !!session?.user, 
      userEmail: session?.user?.email,
      sessionError 
    });
    
    if (sessionError || !session?.user) {
      console.log('[API Users] Authentication failed:', sessionError);
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const isAdmin = session.user.email === 'admin@superwave.io' || session.user.user_metadata?.role === 'admin';
    
    console.log('[API Users] Admin check:', { 
      userEmail: session.user.email, 
      isAdmin,
      userMetadata: session.user.user_metadata 
    });
    
    if (!isAdmin) {
      console.log('[API Users] Access denied - not admin');
      return NextResponse.json(
        { error: 'Forbidden: Requires admin privileges' },
        { status: 403 }
      );
    }

    // 2. Use admin client to fetch all users and their domains
    console.log('[API Users] Creating admin client...');
    const adminSupabase = createAdminClient();
    
    console.log('[API Users] Fetching user profiles...');
    // Fetch all user profiles with their assigned domains
    const { data: users, error: usersError } = await adminSupabase
      .from('user_profiles')
      .select(`
        id,
        email,
        name,
        role,
        active,
        status,
        created_at,
        confirmed_at
      `)
      .order('created_at', { ascending: false });

    console.log('[API Users] Users query result:', { 
      userCount: users?.length, 
      usersError,
      sampleUser: users?.[0]
    });

    if (usersError) {
      console.error('[API Users] Error fetching users:', usersError);
      return NextResponse.json(
        { error: `Failed to fetch users: ${usersError.message}` },
        { status: 500 }
      );
    }

    // Fetch domain assignments for all users
    const { data: domainAssignments, error: domainsError } = await adminSupabase
      .from('domain_assignments')
      .select('user_id, domain_name');

    if (domainsError) {
      console.error('[API Users] Error fetching domain assignments:', domainsError);
      // Continue without domain data rather than failing
    }

    // Group domains by user_id
    const domainsByUser = (domainAssignments || []).reduce((acc: Record<string, string[]>, assignment) => {
      if (!acc[assignment.user_id]) {
        acc[assignment.user_id] = [];
      }
      acc[assignment.user_id].push(assignment.domain_name);
      return acc;
    }, {});

    // Combine users with their domains
    const usersWithDomains = users.map(user => ({
      ...user,
      domains: domainsByUser[user.id] || []
    }));

    return NextResponse.json(usersWithDomains);

  } catch (error) {
    console.error('[API Users] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
