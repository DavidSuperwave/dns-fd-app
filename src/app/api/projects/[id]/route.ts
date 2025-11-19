/**
 * Get project by ID with company profile data
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const resolvedCookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return resolvedCookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }


    // Get project
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get company profile with full data
    if (project.company_profile_id) {
      const { data: companyProfile, error: profileError } = await supabaseAdmin
        .from('company_profiles')
        .select('*')
        .eq('id', project.company_profile_id)
        .single();

      if (profileError) {
        console.error('[API Project] Error fetching company profile:', profileError);
      }

      console.log('[API Project] Company profile data:', {
        id: companyProfile?.id,
        hasCompanyReport: !!companyProfile?.company_report,
        companyReportType: typeof companyProfile?.company_report,
        companyReport: companyProfile?.company_report,
        phaseData: companyProfile?.company_report?.phase_data,
        phase1Data: companyProfile?.company_report?.phase_data?.phase_1_company_report,
        hasPhase1: !!companyProfile?.company_report?.phase_data?.phase_1_company_report,
      });

      return NextResponse.json({
        success: true,
        project: {
          ...project,
          companyProfile,
        },
      });
    }

    return NextResponse.json({
      success: true,
      project,
    });

  } catch (error) {
    console.error('[API Project] Unexpected error:', error);
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
  const { id } = await params;
  const resolvedCookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return resolvedCookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const action = body?.action as string | undefined;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    switch (action) {
      case 'archive':
        updates.status = 'archived';
        updates.deleted_at = null;
        break;
      case 'unarchive':
        updates.status = 'active';
        break;
      case 'delete':
        updates.status = 'deleted';
        updates.deleted_at = new Date().toISOString();
        break;
      case 'restore':
        updates.status = 'active';
        updates.deleted_at = null;
        break;
      default:
        return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    const { data: project, error: updateError } = await supabaseAdmin
      .from('projects')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('[API Project] Failed to update project:', updateError);
      return NextResponse.json(
        { error: 'Failed to update project', details: updateError.message },
        { status: 500 }
      );
    }

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error('[API Project] Unexpected error (PATCH):', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

