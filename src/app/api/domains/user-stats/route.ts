import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

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
            console.warn(`[API DomainStats] Failed to set cookie '${name}'.`, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            resolvedCookieStore.set({ name, value: '', ...options });
          } catch (error) {
            console.warn(`[API DomainStats] Failed to remove cookie '${name}'.`, error);
          }
        },
      },
    }
  );

  try {
    // 1. Verify requesting user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.user) {
      console.log('[API DomainStats] Authentication failed:', sessionError);
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = session.user;
    const userEmail = user.email;
    const isAdmin = user.email === process.env.ADMIN_EMAIL || user.user_metadata?.role === 'admin';

    // Create admin client for database queries
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let domainCount = 0;

    if (isAdmin) {
      // Admin: Get total domain count
      const { count, error: countError } = await adminSupabase
        .from('domains')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.error('[API DomainStats] Error fetching total domain count:', countError);
        return NextResponse.json(
          { error: 'Failed to fetch domain statistics' },
          { status: 500 }
        );
      }

      domainCount = count || 0;
    } else {
      // Regular user: Get domains assigned to them
      // First try domain_assignments table
      const { data: assignments, error: assignmentsError } = await adminSupabase
        .from('domain_assignments')
        .select('domain_id')
        .eq('user_email', userEmail);

      let assignmentCount = 0;
      if (assignmentsError) {
        console.warn('[API DomainStats] Error fetching domain assignments:', assignmentsError);
      } else {
        assignmentCount = assignments?.length || 0;
      }

      // Also check domains table for direct user_id assignments
      const { count: directCount, error: directError } = await adminSupabase
        .from('domains')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      let directAssignmentCount = 0;
      if (directError) {
        console.warn('[API DomainStats] Error fetching direct domain assignments:', directError);
      } else {
        directAssignmentCount = directCount || 0;
      }

      // Use the higher count (in case there are both assignment types)
      domainCount = Math.max(assignmentCount, directAssignmentCount);
    }

    return NextResponse.json({
      success: true,
      domainCount,
      userEmail,
      isAdmin
    });

  } catch (error) {
    console.error('[API DomainStats] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
