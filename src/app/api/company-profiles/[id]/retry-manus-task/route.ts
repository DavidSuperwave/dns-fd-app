/**
 * Retry creating Manus task for a company profile that failed initially
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createManusTask } from '@/lib/manus-ai-client';
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

    // Check if task already exists
    if (companyProfile.manus_workflow_id) {
      return NextResponse.json({
        success: true,
        message: 'Manus task already exists',
        task_id: companyProfile.manus_workflow_id,
      });
    }

    // Check if MANUS_API_KEY is set
    if (!process.env.MANUS_API_KEY) {
      return NextResponse.json({
        error: 'MANUS_API_KEY is not configured',
        details: 'Please add MANUS_API_KEY to .env and restart the server',
      }, { status: 500 });
    }

    // Get files for this company profile
    const { data: files } = await supabaseAdmin
      .from('company_profile_files')
      .select('*')
      .eq('company_profile_id', id);

    // Upload files to Manus if any
    const manusFileIds: string[] = [];
    const fileNames: string[] = [];
    
    if (files && files.length > 0) {
      // Note: Files are already in Supabase Storage, we'd need to download and re-upload to Manus
      // For now, skip file uploads on retry (or implement file download from storage)
      fileNames.push(...files.map(f => f.file_name));
    }

    // Build Phase 1 prompt
    const currentPhase: WorkflowPhase = 'phase_1_company_report';
    const phase1Config = WORKFLOW_PHASES[currentPhase];
    const phase1Prompt = phase1Config.promptBuilder({
      clientName: companyProfile.client_name,
      industry: companyProfile.industry,
      offerService: companyProfile.offer_service,
      pricing: companyProfile.pricing,
      targetMarket: companyProfile.target_market,
      goals: companyProfile.goals,
      fileNames: fileNames.length > 0 ? fileNames : undefined,
    });

    // Create Manus AI task
    try {
      const manusTask = await createManusTask(phase1Prompt, manusFileIds, {
        agentProfile: 'manus-1.5',
        taskMode: 'agent',
        hideInTaskList: false,
        createShareableLink: true,
      });

      // Update company profile with Manus task ID
      await supabaseAdmin
        .from('company_profiles')
        .update({
          manus_workflow_id: manusTask.task_id,
          workflow_status: mapPhaseToWorkflowStatus(currentPhase),
          company_report: {
            current_phase: currentPhase,
            phases_completed: [],
            phase_data: {},
          },
        })
        .eq('id', id);


      return NextResponse.json({
        success: true,
        message: 'Manus task created successfully',
        task_id: manusTask.task_id,
        task_url: manusTask.task_url,
      });

    } catch (manusError) {
      console.error('[Retry Manus Task] Error:', manusError);
      return NextResponse.json({
        error: 'Failed to create Manus task',
        details: manusError instanceof Error ? manusError.message : 'Unknown error',
        checkApiKey: !process.env.MANUS_API_KEY ? 'MANUS_API_KEY is not set' : 'API key is set',
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[Retry Manus Task] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

