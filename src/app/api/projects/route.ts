import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

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
            console.warn(`[API Projects] Failed to set cookie '${name}'.`, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            resolvedCookieStore.set({ name, value: '', ...options });
          } catch (error) {
            console.warn(`[API Projects] Failed to remove cookie '${name}'.`, error);
          }
        },
      },
    }
  );

  try {
    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';
    const debug = searchParams.get('debug') === 'true';

    // Create admin client for database queries
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Debug: Check all projects in database (if debug mode)
    if (debug) {
      const { data: allProjects } = await adminSupabase
        .from('projects')
        .select('id, name, user_id, status, deleted_at, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      
      console.log('[API Projects] DEBUG - All projects in DB:', allProjects);
      console.log('[API Projects] DEBUG - Querying for user_id:', user.id);
      console.log('[API Projects] DEBUG - User email:', user.email);
    }

    // Build query based on filter
    let query = adminSupabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id);

    if (filter === 'all') {
      query = query.is('deleted_at', null);
    } else if (filter === 'deleted') {
      query = query.not('deleted_at', 'is', null);
    }

    const { data: projects, error: projectsError } = await query.order('created_at', { ascending: false });

    if (projectsError) {
      console.error('[API Projects] Error fetching projects:', projectsError);
      return NextResponse.json(
        { error: 'Failed to fetch projects', details: projectsError.message },
        { status: 500 }
      );
    }

    console.log('[API Projects] Fetched projects for user:', user.id, 'Count:', projects?.length || 0);
    console.log('[API Projects] User email:', user.email);
    
    if (projects && projects.length > 0) {
      console.log('[API Projects] Sample project:', {
        id: projects[0].id,
        name: projects[0].name,
        status: projects[0].status,
        user_id: projects[0].user_id,
        deleted_at: projects[0].deleted_at
      });
    } else {
      console.warn('[API Projects] No projects found. Check if:');
      console.warn('  1. Project user_id matches logged-in user.id');
      console.warn('  2. Project deleted_at is NULL (for filter=all)');
      console.warn('  3. Project exists in database');
      console.warn('  Add ?debug=true to URL to see all projects in DB');
    }

    return NextResponse.json({
      success: true,
      projects: projects || [],
    });

  } catch (error) {
    console.error('[API Projects] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

