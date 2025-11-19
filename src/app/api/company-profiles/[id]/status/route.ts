/**
 * Check Manus AI task status and update company profile
 * Can be polled by frontend or called by cron job
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getManusTaskStatus } from '@/lib/manus-ai-client';
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
      .eq('user_id', user.id) // Ensure user can only check their own profiles
      .single();

    if (fetchError || !companyProfile) {
      return NextResponse.json({ error: 'Company profile not found' }, { status: 404 });
    }

    // If no Manus workflow ID, return current status with error info
    if (!companyProfile.manus_workflow_id) {
      return NextResponse.json({
        success: true,
        workflow_status: companyProfile.workflow_status,
        manus_status: null,
        error: 'No Manus task created. Check server logs for errors. Make sure MANUS_API_KEY is set in .env',
        companyProfile,
      });
    }

    // Check Manus task status
    try {
      const taskStatus = await getManusTaskStatus(companyProfile.manus_workflow_id);

      // Map Manus status to our workflow status
      let workflowStatus = companyProfile.workflow_status;
      let updateData: any = {};

      if (taskStatus.status === 'completed') {
        workflowStatus = 'completed';
        updateData = {
          workflow_status: 'completed',
          company_report: taskStatus.result || companyProfile.company_report,
          completed_at: new Date().toISOString(),
        };
      } else if (taskStatus.status === 'failed') {
        workflowStatus = 'failed';
        updateData = {
          workflow_status: 'failed',
        };
      } else if (taskStatus.status === 'running') {
        // Progress through workflow states
        const statusProgression = ['generating', 'creating_report', 'validating_report', 'finding_competitors'];
        const currentIndex = statusProgression.indexOf(companyProfile.workflow_status);
        if (currentIndex < statusProgression.length - 1) {
          workflowStatus = statusProgression[currentIndex + 1];
          updateData = {
            workflow_status: workflowStatus,
          };
        }
      }

      // Update company profile if status changed
      if (Object.keys(updateData).length > 0) {
        await supabaseAdmin
          .from('company_profiles')
          .update(updateData)
          .eq('id', id);
      }

      return NextResponse.json({
        success: true,
        workflow_status: workflowStatus,
        manus_status: taskStatus.status,
        companyProfile: {
          ...companyProfile,
          workflow_status: workflowStatus,
        },
      });

    } catch (manusError) {
      console.error('[API Status Check] Error checking Manus status:', manusError);
      // Return current status even if Manus check fails
      return NextResponse.json({
        success: true,
        workflow_status: companyProfile.workflow_status,
        companyProfile,
        error: 'Failed to check Manus status',
      });
    }

  } catch (error) {
    console.error('[API Status Check] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

