/**
 * Advance to the next phase of the Manus workflow
 * This continues the same task with a new prompt, maintaining context
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { continueManusTask } from '@/lib/manus-ai-client';
import { WORKFLOW_PHASES, mapPhaseToWorkflowStatus, type WorkflowPhase } from '@/lib/manus-workflow-phases';
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
        set() { },
        remove() { },
      },
    }
  );

  try {
    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { phaseData, additionalData } = body; // Data from previous phase and any extra params

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

    // Get current phase from company_report metadata
    const reportData = companyProfile.company_report || {};
    const currentPhase = (reportData.current_phase || 'phase_1_company_report') as WorkflowPhase;
    const phasesCompleted = reportData.phases_completed || [];
    const phaseDataStore = reportData.phase_data || {};

    // Determine next phase
    const currentPhaseConfig = WORKFLOW_PHASES[currentPhase];
    if (!currentPhaseConfig || !currentPhaseConfig.nextPhase) {
      return NextResponse.json({ error: 'Workflow already completed' }, { status: 400 });
    }

    const nextPhase = currentPhaseConfig.nextPhase as string as WorkflowPhase;
    const nextPhaseConfig = WORKFLOW_PHASES[nextPhase];

    // Store data from current phase
    phaseDataStore[currentPhase] = phaseData;

    // Build prompt for next phase
    let nextPhasePrompt: string;

    if (nextPhase === 'phase_2_icp_report') {
      // Phase 2 uses Phase 1 data
      nextPhasePrompt = nextPhaseConfig.promptBuilder({
        companyReport: phaseDataStore.phase_1_company_report,
        ...additionalData
      });
    } else if (nextPhase === 'phase_3_campaigns') {
      // Phase 3 uses Phase 1 & 2 data
      // Extract targetSubNicheId from selectedIcpIds if provided
      let targetSubNicheId = additionalData?.targetSubNicheId;

      if (!targetSubNicheId && additionalData?.selectedIcpIds?.length > 0) {
        // Auto-select first sub-niche from first selected ICP
        const icpReport = phaseDataStore.phase_2_icp_report;
        const firstIcpId = additionalData.selectedIcpIds[0];

        if (icpReport?.icp_reports) {
          const selectedIcp = icpReport.icp_reports.find((icp: any) => icp.icp_id === firstIcpId);
          if (selectedIcp?.sub_niches?.[0]?.sub_niche_id) {
            targetSubNicheId = selectedIcp.sub_niches[0].sub_niche_id;
            console.log('[Advance Phase] Auto-selected targetSubNicheId:', targetSubNicheId, 'from ICP:', firstIcpId);
          }
        }
      }

      nextPhasePrompt = nextPhaseConfig.promptBuilder({
        companyReport: phaseDataStore.phase_1_company_report,
        icpReport: phaseDataStore.phase_2_icp_report,
        targetSubNicheId,
        ...additionalData
      });
    } else {
      return NextResponse.json({ error: 'Invalid phase' }, { status: 400 });
    }

    // Continue the same Manus task with next phase prompt
    try {
      await continueManusTask(companyProfile.manus_workflow_id, nextPhasePrompt);

      // Update company profile with new phase
      phasesCompleted.push(currentPhase);

      await supabaseAdmin
        .from('company_profiles')
        .update({
          workflow_status: mapPhaseToWorkflowStatus(nextPhase),
          company_report: {
            current_phase: nextPhase,
            phases_completed: phasesCompleted,
            phase_data: phaseDataStore,
          },
        })
        .eq('id', id);


      return NextResponse.json({
        success: true,
        currentPhase: nextPhase,
        phasesCompleted: phasesCompleted,
      });

    } catch (manusError) {
      console.error('[API Advance Phase] Error continuing Manus task:', manusError);
      return NextResponse.json(
        { error: 'Failed to advance phase', details: manusError instanceof Error ? manusError.message : 'Unknown error' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[API Advance Phase] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

