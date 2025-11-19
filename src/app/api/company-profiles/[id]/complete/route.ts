import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Create admin client for database queries
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/company-profiles/[id]/complete
 * Manually complete a company profile workflow (for testing)
 * This will trigger the database trigger to create a project
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedCookieStore = await cookies();
  const { id } = await params;

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
            console.warn(`[API Company Profile Complete] Failed to set cookie.`, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            resolvedCookieStore.set({ name, value: '', ...options });
          } catch (error) {
            console.warn(`[API Company Profile Complete] Failed to remove cookie.`, error);
          }
        },
      },
    }
  );

  try {
    // 1. Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Verify company profile exists and belongs to user
    const { data: companyProfile, error: profileError } = await supabaseAdmin
      .from('company_profiles')
      .select('id, user_id, workflow_status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (profileError || !companyProfile) {
      return NextResponse.json(
        { error: 'Company profile not found' },
        { status: 404 }
      );
    }

    // 3. Update workflow status to 'completed'
    // This will trigger the database trigger to create a project
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('company_profiles')
      .update({
        workflow_status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updatedProfile) {
      console.error('[API Company Profile Complete] Error updating profile:', updateError);
      return NextResponse.json(
        { error: 'Failed to complete company profile' },
        { status: 500 }
      );
    }

    // 4. Check if project was created (trigger should have created it)
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('company_profile_id', id)
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({
      success: true,
      companyProfile: updatedProfile,
      project: project,
      message: 'Company profile completed. Project created automatically.',
    });

  } catch (error) {
    console.error('[API Company Profile Complete] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

