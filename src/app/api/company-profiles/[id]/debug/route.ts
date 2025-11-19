/**
 * Debug endpoint to check Manus task status
 * GET /api/company-profiles/[id]/debug
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getManusTaskStatus } from '@/lib/manus-ai-client';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { parseManusReportPayload } from '@/lib/manus-result-parser';
import { mapPhaseToWorkflowStatus, type WorkflowPhase } from '@/lib/manus-workflow-phases';

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
        set() { },
        remove() { },
      },
    }
  );

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get company profile
    const { data: fetchedProfile, error: fetchError } = await supabaseAdmin
      .from('company_profiles')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !fetchedProfile) {
      return NextResponse.json({ error: 'Company profile not found' }, { status: 404 });
    }

    let companyProfile = fetchedProfile;

    const debugInfo: any = {
      companyProfile: getCompanyProfileSummary(companyProfile),
      phaseInfo: getPhaseInfo(companyProfile),
      taskStatus: null,
      taskStatusRaw: null,
      error: null,
    };

    // Check Manus task status if task ID exists
    if (companyProfile.manus_workflow_id) {
      try {
        const taskStatus = await getManusTaskStatus(companyProfile.manus_workflow_id);
        debugInfo.taskStatus = {
          task_id: taskStatus.task_id,
          status: taskStatus.status,
          has_result: !!taskStatus.result,
          error: taskStatus.error || null,
        };
        debugInfo.taskStatusRaw = taskStatus;

        const searchParams = request.nextUrl.searchParams;
        const shouldImport =
          searchParams.get('import') === 'true' || searchParams.get('import') === '1';
        const forceImport =
          searchParams.get('force') === 'true' || searchParams.get('force') === '1';
        const importPhaseParam = searchParams.get('importPhase');
        const targetPhase = resolveTargetPhase(
          importPhaseParam,
          companyProfile.company_report?.current_phase as WorkflowPhase | undefined
        );

        if (shouldImport && taskStatus.status === 'completed' && targetPhase) {
          try {
            const importResult = await importPhaseResult(
              companyProfile,
              taskStatus.result,
              targetPhase,
              { force: forceImport }
            );
            if (importResult?.updatedProfile) {
              companyProfile = importResult.updatedProfile;
              debugInfo.companyProfile = getCompanyProfileSummary(companyProfile);
              debugInfo.phaseInfo = getPhaseInfo(companyProfile);
            }
            debugInfo.import = {
              attempted: true,
              targetPhase,
              forced: forceImport,
              ...importResult,
            };
          } catch (importError) {
            console.error('[API Debug] Failed to import phase result:', importError);
            debugInfo.import = {
              attempted: true,
              targetPhase,
              forced: forceImport,
              error: importError instanceof Error ? importError.message : 'Unknown error',
            };
          }
        } else if (shouldImport) {
          debugInfo.import = {
            attempted: true,
            targetPhase,
            skipped: true,
            reason: taskStatus.status !== 'completed'
              ? `Task status is '${taskStatus.status}', waiting for completion`
              : !targetPhase
                ? 'Unable to determine target phase'
                : undefined,
            forced: forceImport,
          };
        }
      } catch (manusError) {
        debugInfo.error = manusError instanceof Error ? manusError.message : 'Unknown error';
        debugInfo.taskStatus = {
          error: 'Failed to fetch task status',
          details: debugInfo.error,
        };
      }
    } else {
      debugInfo.error = 'No Manus workflow ID found. Task may not have been created.';
    }

    return NextResponse.json({
      success: true,
      debug: debugInfo,
    });

  } catch (error) {
    console.error('[API Debug] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

const WORKFLOW_PHASES: WorkflowPhase[] = [
  'phase_1_company_report',
  'phase_2_icp_report',
  'phase_3_campaigns',
  'phase_4_optimization',
  'phase_5_final_optimization',
  'completed',
];

function getCompanyProfileSummary(profile: any) {
  return {
    id: profile.id,
    client_name: profile.client_name,
    workflow_status: profile.workflow_status,
    manus_workflow_id: profile.manus_workflow_id,
    created_at: profile.created_at,
  };
}

function getPhaseInfo(profile: any) {
  return {
    current_phase: profile.company_report?.current_phase || null,
    phases_completed: profile.company_report?.phases_completed || [],
    has_phase_1_data: !!profile.company_report?.phase_data?.phase_1_company_report,
    has_phase_2_data: !!profile.company_report?.phase_data?.phase_2_icp_report,
  };
}

function resolveTargetPhase(
  overridePhase: string | null,
  currentPhase: WorkflowPhase | undefined
): WorkflowPhase | null {
  if (overridePhase && WORKFLOW_PHASES.includes(overridePhase as WorkflowPhase)) {
    return overridePhase as WorkflowPhase;
  }

  return currentPhase ?? 'phase_1_company_report';
}

interface ImportOptions {
  force?: boolean;
}

async function importPhaseResult(
  companyProfile: any,
  taskResult: any,
  targetPhase: WorkflowPhase,
  options: ImportOptions = {}
): Promise<{ imported: boolean; reason?: string; updatedProfile?: any }> {
  if (!taskResult) {
    return { imported: false, reason: 'No task result available to import' };
  }

  const reportData = companyProfile.company_report || {};
  const existingPhaseData = { ...(reportData.phase_data || {}) };

  if (existingPhaseData[targetPhase] && !options.force) {
    return { imported: false, reason: `Phase data for ${targetPhase} already exists` };
  }

  let normalizedResult = await parseManusReportPayload(taskResult);
  if (!normalizedResult) {
    if (typeof taskResult === 'string' || typeof taskResult === 'object') {
      normalizedResult = taskResult;
    }
  }

  if (!normalizedResult) {
    return { imported: false, reason: 'Unable to parse Manus result into structured data' };
  }

  const phasesCompleted: WorkflowPhase[] = Array.isArray(reportData.phases_completed)
    ? Array.from(new Set([...(reportData.phases_completed as WorkflowPhase[]), targetPhase]))
    : [targetPhase];

  const updatedReport = {
    ...reportData,
    phase_data: {
      ...existingPhaseData,
      [targetPhase]: normalizedResult,
    },
    phases_completed: phasesCompleted,
  };

  const { data: updatedProfile, error: updateError } = await supabaseAdmin
    .from('company_profiles')
    .update({
      workflow_status: mapPhaseToWorkflowStatus(targetPhase),
      company_report: updatedReport,
    })
    .eq('id', companyProfile.id)
    .select()
    .single();

  if (updateError) {
    throw updateError;
  }

  return {
    imported: true,
    updatedProfile,
  };
}

