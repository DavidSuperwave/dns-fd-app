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

export async function GET(
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
            console.warn(`[API Company Profile] Failed to set cookie '${name}'.`, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            resolvedCookieStore.set({ name, value: '', ...options });
          } catch (error) {
            console.warn(`[API Company Profile] Failed to remove cookie '${name}'.`, error);
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

    // 2. Get company profile
    const { data: companyProfile, error: profileError } = await supabaseAdmin
      .from('company_profiles')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id) // Ensure user owns this profile
      .single();

    if (profileError || !companyProfile) {
      return NextResponse.json(
        { error: 'Company profile not found' },
        { status: 404 }
      );
    }

    // 3. Get associated files
    const { data: files } = await supabaseAdmin
      .from('company_profile_files')
      .select('*')
      .eq('company_profile_id', id)
      .order('uploaded_at', { ascending: false });

    // 4. Check if project was created (when workflow_status = 'completed')
    let project = null;
    if (companyProfile.workflow_status === 'completed') {
      const { data: projectData } = await supabaseAdmin
        .from('projects')
        .select('*')
        .eq('company_profile_id', id)
        .eq('user_id', user.id)
        .single();

      project = projectData;
    }

    return NextResponse.json({
      success: true,
      companyProfile: {
        ...companyProfile,
        files: files || [],
        project: project,
      },
    });

  } catch (error) {
    console.error('[API Company Profile] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
            console.warn(`[API Company Profile] Failed to set cookie '${name}'.`, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            resolvedCookieStore.set({ name, value: '', ...options });
          } catch (error) {
            console.warn(`[API Company Profile] Failed to remove cookie '${name}'.`, error);
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

    const body = await request.json();
    const { campaigns } = body;

    if (!campaigns) {
      return NextResponse.json(
        { error: 'Campaigns data is required' },
        { status: 400 }
      );
    }

    // 2. Get current company profile to merge data
    const { data: currentProfile, error: fetchError } = await supabaseAdmin
      .from('company_profiles')
      .select('company_report')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !currentProfile) {
      return NextResponse.json(
        { error: 'Company profile not found' },
        { status: 404 }
      );
    }

    // 3. Update the report data
    // We need to preserve existing data and only update phase_3_campaigns
    const currentReport = currentProfile.company_report || {};
    const phaseData = currentReport.phase_data || {};

    const updatedReport = {
      ...currentReport,
      phase_data: {
        ...phaseData,
        phase_3_campaigns: campaigns
      }
    };

    // 4. Save to database
    const { error: updateError } = await supabaseAdmin
      .from('company_profiles')
      .update({
        company_report: updatedReport,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('[API Company Profile] Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Campaigns updated successfully'
    });

  } catch (error) {
    console.error('[API Company Profile] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

