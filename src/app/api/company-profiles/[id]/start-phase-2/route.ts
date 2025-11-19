/**
 * Manually start Phase 2 (ICP Report) after Phase 1 is approved
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { continueManusTask } from '@/lib/manus-ai-client';
import { WORKFLOW_PHASES, mapPhaseToWorkflowStatus } from '@/lib/manus-workflow-phases';
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

  // Create Supabase client for auth check
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
    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }


    // Get company profile
    const { data: companyProfile, error: fetchError } = await supabaseAdmin
      .from('company_profiles')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !companyProfile) {
      return NextResponse.json({ error: 'Company profile not found' }, { status: 404 });
    }

    if (!companyProfile.manus_workflow_id) {
      return NextResponse.json({ error: 'No Manus workflow found' }, { status: 400 });
    }

    // Get current phase data
    const reportData = companyProfile.company_report || {};
    const currentPhase = reportData.current_phase || 'phase_1_company_report';
    const phasesCompleted = reportData.phases_completed || [];
    const phaseDataStore = reportData.phase_data || {};

    // Verify we're in Phase 1
    if (currentPhase !== 'phase_1_company_report') {
      return NextResponse.json({ 
        error: 'Phase 2 can only be started after Phase 1 is completed',
        currentPhase 
      }, { status: 400 });
    }

    // Verify Phase 1 data exists
    if (!phaseDataStore.phase_1_company_report) {
      return NextResponse.json({ 
        error: 'Phase 1 report not found. Please wait for Phase 1 to complete.' 
      }, { status: 400 });
    }

    // Build Phase 2 prompt
    const phase2Config = WORKFLOW_PHASES.phase_2_icp_report;
    const phase2Prompt = phase2Config.promptBuilder({
      companyReport: phaseDataStore.phase_1_company_report,
    });

    // Continue the same Manus task with Phase 2 prompt
    try {
      await continueManusTask(companyProfile.manus_workflow_id, phase2Prompt);

      // Update company profile to Phase 2
      await supabaseAdmin
        .from('company_profiles')
        .update({
          workflow_status: mapPhaseToWorkflowStatus('phase_2_icp_report'),
          company_report: {
            current_phase: 'phase_2_icp_report',
            phases_completed: phasesCompleted,
            phase_data: phaseDataStore,
          },
        })
        .eq('id', id);


      return NextResponse.json({
        success: true,
        message: 'Phase 2 (ICP Report) started successfully',
        currentPhase: 'phase_2_icp_report',
      });

    } catch (manusError) {
      console.error('[API Start Phase 2] Error starting Phase 2:', manusError);
      return NextResponse.json(
        { error: 'Failed to start Phase 2', details: manusError instanceof Error ? manusError.message : 'Unknown error' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[API Start Phase 2] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

