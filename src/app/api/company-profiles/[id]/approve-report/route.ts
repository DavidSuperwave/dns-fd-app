import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
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

    const { data: companyProfile, error: fetchError } = await supabaseAdmin
      .from('company_profiles')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !companyProfile) {
      return NextResponse.json({ error: 'Company profile not found' }, { status: 404 });
    }

    const reportData = companyProfile.company_report || {};
    const phaseData = reportData.phase_data || {};

    if (!phaseData.phase_1_company_report) {
      return NextResponse.json({
        error: 'Phase 1 report not available yet',
      }, { status: 400 });
    }

    const approvalTimestamp = new Date().toISOString();

    const updatedCompanyReport = {
      ...reportData,
      phase_data: phaseData,
      phase_1_approved_at: approvalTimestamp,
      phase_1_approved_by: user.id,
    };

    const { error: updateError } = await supabaseAdmin
      .from('company_profiles')
      .update({
        workflow_status: 'completed',
        company_report: updatedCompanyReport,
      })
      .eq('id', id);

    if (updateError) {
      console.error('[Approve Report] Failed to update company profile:', updateError);
      return NextResponse.json({ error: 'Failed to update company profile' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      workflow_status: 'completed',
      approved_at: approvalTimestamp,
    });

  } catch (error) {
    console.error('[Approve Report] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


