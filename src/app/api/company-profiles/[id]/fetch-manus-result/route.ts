/**
 * Manually fetch the result from Manus API and save it to the database
 * Use this if the webhook didn't save the result
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getManusTaskStatus } from '@/lib/manus-ai-client';
import { mapPhaseToWorkflowStatus, type WorkflowPhase } from '@/lib/manus-workflow-phases';
import { hasManusReportShape, parseManusReportPayload } from '@/lib/manus-result-parser';

const ASSISTANT_ROLES = new Set(['assistant', 'model', 'ai']);

function findBestAssistantMessage(messages: any[]): any {
  if (!Array.isArray(messages)) return messages;

  const assistantMessages = messages.filter(
    (msg: any) => msg && typeof msg === 'object' && ASSISTANT_ROLES.has(msg.role)
  );

  if (assistantMessages.length === 0) {
    return messages[messages.length - 1];
  }

  const hasOutputFile = (msg: any) =>
    Array.isArray(msg.content) &&
    msg.content.some(
      (item: any) =>
        item &&
        item.type === 'output_file' &&
        (item.fileUrl || item.file_url || item.url)
    );

  const hasReportObject = (msg: any) =>
    Array.isArray(msg.content) &&
    msg.content.some(
      (item: any) => item && typeof item === 'object' && hasManusReportShape(item)
    );

  const hasJsonText = (msg: any) =>
    Array.isArray(msg.content) &&
    msg.content.some(
      (item: any) =>
        typeof item?.text === 'string' &&
        item.text.includes('{') &&
        item.text.includes('company')
    );

  return (
    assistantMessages.find(hasOutputFile) ||
    assistantMessages.find(hasReportObject) ||
    assistantMessages.find(hasJsonText) ||
    assistantMessages[assistantMessages.length - 1]
  );
}

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
      return NextResponse.json({ error: 'No Manus task ID found' }, { status: 400 });
    }

    // Fetch task status from Manus API
    console.log('[Fetch Manus Result] Fetching task status for:', companyProfile.manus_workflow_id);
    const taskStatus = await getManusTaskStatus(companyProfile.manus_workflow_id);

    console.log('[Fetch Manus Result] Full task status response:', JSON.stringify(taskStatus, null, 2));
    console.log('[Fetch Manus Result] Task status:', {
      status: taskStatus.status,
      hasResult: !!taskStatus.result,
      resultType: typeof taskStatus.result,
      resultIsNull: taskStatus.result === null,
      resultIsUndefined: taskStatus.result === undefined,
      allKeys: Object.keys(taskStatus),
    });

    if (taskStatus.status !== 'completed') {
      return NextResponse.json({
        error: 'Task is not completed yet',
        taskStatus: taskStatus.status,
      }, { status: 400 });
    }

    // Check if result exists - it might be in a different field
    let result = taskStatus.result;

    // Manus might return result in different fields - check common alternatives
    if (!result) {
      result = (taskStatus as any).output || (taskStatus as any).data || (taskStatus as any).content || (taskStatus as any).messages;
      console.log('[Fetch Manus Result] Checking alternative fields:', {
        hasOutput: !!(taskStatus as any).output,
        hasData: !!(taskStatus as any).data,
        hasContent: !!(taskStatus as any).content,
        hasMessages: !!(taskStatus as any).messages,
        foundResult: !!result,
      });
    }

    // If result is an array of messages, find the assistant's response (not the user's input)
    if (Array.isArray(result)) {
      console.log('[Fetch Manus Result] Result is an array of messages, length:', result.length);
      const assistantMessage = findBestAssistantMessage(result);
      if (assistantMessage) {
        console.log('[Fetch Manus Result] Selected assistant message with role:', assistantMessage?.role);
        result = assistantMessage;
      } else {
        console.log('[Fetch Manus Result] Falling back to last message in array.');
        result = result[result.length - 1];
      }
    }

    if (!result) {
      return NextResponse.json({
        error: 'Result is not available in task status',
        taskStatus: taskStatus.status,
        availableFields: Object.keys(taskStatus),
        fullResponse: taskStatus,
      }, { status: 400 });
    }

    // Get current phase from company_report metadata
    const reportData = companyProfile.company_report || {};
    const currentPhase = (reportData.current_phase || 'phase_1_company_report') as WorkflowPhase;
    const phasesCompleted = reportData.phases_completed || [];
    const phaseDataStore = reportData.phase_data || {};

    const structuredReport = await parseManusReportPayload(result);
    let normalizedResult = structuredReport ?? result;

    const isUserMessage = normalizedResult && typeof normalizedResult === 'object' && !Array.isArray(normalizedResult) && normalizedResult.role === 'user';
    if (isUserMessage) {
      console.warn('[Fetch Manus Result] Result is a user message (input prompt), not the report.');
      return NextResponse.json({
        error: 'Received user input message instead of assistant response. The task may still be processing, or the result structure is different.',
        taskStatus: taskStatus.status,
        receivedRole: normalizedResult.role,
      }, { status: 400 });
    }

    if (structuredReport) {
      console.log('[Fetch Manus Result] Structured report extracted from Manus payload.');
      normalizedResult = structuredReport;
    } else {
      console.warn('[Fetch Manus Result] Structured report not found in payload. Storing raw result for debugging.');
    }

    console.log('[Fetch Manus Result] Final normalized result:', {
      isArray: Array.isArray(normalizedResult),
      isObject: typeof normalizedResult === 'object' && normalizedResult !== null && !Array.isArray(normalizedResult),
      hasReportShape: hasManusReportShape(normalizedResult),
      sample: normalizedResult ? JSON.stringify(normalizedResult).substring(0, 200) : 'null',
    });

    // Store the result in phase_data
    phaseDataStore[currentPhase] = normalizedResult;
    if (!phasesCompleted.includes(currentPhase)) {
      phasesCompleted.push(currentPhase);
    }

    // Update company profile
    // For Phase 1, set status to 'reviewing' to trigger the approval UI
    const workflowStatus = currentPhase === 'phase_1_company_report' ? 'reviewing' : mapPhaseToWorkflowStatus(currentPhase);
    const { error: updateError } = await supabaseAdmin
      .from('company_profiles')
      .update({
        workflow_status: workflowStatus,
        company_report: {
          current_phase: currentPhase,
          phases_completed: phasesCompleted,
          phase_data: phaseDataStore,
        },
      })
      .eq('id', id);

    if (updateError) {
      console.error('[Fetch Manus Result] Error updating company profile:', updateError);
      return NextResponse.json({ error: 'Failed to update company profile' }, { status: 500 });
    }

    console.log('[Fetch Manus Result] Successfully saved result to database');

    return NextResponse.json({
      success: true,
      message: 'Result fetched and saved successfully',
      phase: currentPhase,
      hasResult: true,
    });

  } catch (error) {
    console.error('[Fetch Manus Result] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

