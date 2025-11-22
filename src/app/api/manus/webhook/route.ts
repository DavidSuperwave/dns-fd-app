/**
 * Manus AI Webhook Handler
 * Receives status updates from Manus AI when tasks complete
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { continueManusTask, getManusTaskStatus } from '@/lib/manus-ai-client';
import { WORKFLOW_PHASES, mapPhaseToWorkflowStatus, type WorkflowPhase } from '@/lib/manus-workflow-phases';
import { hasManusReportShape, parseManusReportPayload } from '@/lib/manus-result-parser';

const ASSISTANT_ROLES = new Set(['assistant', 'model', 'ai']);

function findBestAssistantMessage(messages: any[], targetKey?: string): any {
  if (!Array.isArray(messages)) return messages;

  const assistantMessages = messages.filter(
    (msg: any) => msg && typeof msg === 'object' && ASSISTANT_ROLES.has(msg.role)
  );

  if (assistantMessages.length === 0) {
    return messages[messages.length - 1];
  }

  // Helper to check if message contains the specific target key we want
  const hasTargetKey = (msg: any) => {
    if (!targetKey) return false;

    // Check text content
    if (Array.isArray(msg.content)) {
      return msg.content.some((item: any) =>
        typeof item?.text === 'string' && item.text.includes(targetKey)
      );
    }
    return false;
  };

  const hasOutputFile = (msg: any) =>
    Array.isArray(msg.content) &&
    msg.content.some(
      (item: any) =>
        item &&
        item.type === 'output_file' &&
        (item.fileUrl || item.file_url || item.url)
    );

  const hasReportShape = (msg: any) =>
    Array.isArray(msg.content) &&
    msg.content.some(
      (item: any) => item && typeof item === 'object' && hasManusReportShape(item)
    );

  const hasJsonText = (msg: any) =>
    Array.isArray(msg.content) &&
    msg.content.some(
      (item: any) =>
        typeof item?.text === 'string' &&
        (
          item.text.includes('icp_reports') ||
          item.text.includes('client_offer_brief') ||
          item.text.includes('campaign_blueprints') ||
          (item.text.includes('{') && item.text.includes('}'))
        )
    );

  // 1. First priority: Message with the specific target key (e.g. 'icp_reports')
  if (targetKey) {
    for (let i = assistantMessages.length - 1; i >= 0; i--) {
      const msg = assistantMessages[i];
      if (hasTargetKey(msg)) {
        console.log(`[Manus Webhook] Found message with target key: ${targetKey}`);
        return msg;
      }
    }
  }

  // 2. Second priority: General report shape or output file
  // Search backwards to find the LATEST message that looks like a report
  for (let i = assistantMessages.length - 1; i >= 0; i--) {
    const msg = assistantMessages[i];
    if (hasOutputFile(msg) || hasReportShape(msg) || hasJsonText(msg)) {
      return msg;
    }
  }

  return assistantMessages[assistantMessages.length - 1];
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    let body: any = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch (e) {
      console.log('[Manus Webhook] Failed to parse JSON body, treating as empty/verification');
    }

    // LOG THE ENTIRE RAW PAYLOAD
    console.log('[Manus Webhook] RAW PAYLOAD:', JSON.stringify(body, null, 2));

    // Parse Manus's actual webhook structure
    // Manus sends: { event_type: "task_stopped", task_detail: { task_id, stop_reason, message } }
    const eventType = body.event_type;
    const taskDetail = body.task_detail || {};
    const task_id = taskDetail.task_id || body.task_id; // Support both structures
    const stopReason = taskDetail.stop_reason;

    // Check for result in multiple places
    let result = body.result;

    // If result is missing, check task_detail.message (often contains the JSON output)
    // Also check body.message, body.output, body.data as fallbacks
    const potentialMessage = taskDetail.message || body.message || body.output || body.data;

    if (!result && potentialMessage) {
      console.log('[Manus Webhook] Found potential result in message/output field');
      try {
        // It might be a JSON string
        if (typeof potentialMessage === 'string') {
          // Check if it looks like JSON
          if (potentialMessage.trim().startsWith('{') || potentialMessage.trim().startsWith('[')) {
            result = JSON.parse(potentialMessage);
            console.log('[Manus Webhook] Successfully parsed JSON from message field');
          } else {
            result = potentialMessage;
          }
        } else {
          result = potentialMessage;
        }
      } catch (e) {
        console.log('[Manus Webhook] message field is not valid JSON, using as raw string');
        result = potentialMessage;
      }
    }

    console.log('[Manus Webhook] Parsed webhook:', {
      event_type: eventType,
      task_id,
      stop_reason: stopReason,
      hasResult: !!result,
      resultType: typeof result,
      resultPreview: result ? (typeof result === 'string' ? result.substring(0, 200) : JSON.stringify(result).substring(0, 200)) : 'null',
    });

    // Verify this is a real task completion (not a test ping)
    if (!task_id) {
      console.log('[Manus Webhook] Received webhook without task_id (likely verification ping). Returning 200 OK.');
      return NextResponse.json({ success: true, message: 'Webhook verified' }, { status: 200 });
    }

    // Find company profile with this manus_workflow_id
    const { data: companyProfile, error: fetchError } = await supabaseAdmin
      .from('company_profiles')
      .select('id, workflow_status, manus_workflow_id, company_report')
      .eq('manus_workflow_id', task_id)
      .single();

    if (fetchError || !companyProfile) {
      console.error('[Manus Webhook] Company profile not found:', task_id, fetchError);
      return NextResponse.json({ error: 'Company profile not found' }, { status: 404 });
    }

    console.log('[Manus Webhook] Found company profile:', companyProfile.id);

    // If result is missing from webhook, fetch it from Manus API
    if (!result) {
      console.warn('[Manus Webhook] Result is missing from webhook payload. Attempting to fetch from Manus API...');
      try {
        const taskStatus = await getManusTaskStatus(task_id);
        result = taskStatus.result;
        console.log('[Manus Webhook] Successfully fetched result from Manus API');
      } catch (apiError) {
        console.error('[Manus Webhook] Failed to fetch result from Manus API:', apiError);
        return NextResponse.json(
          { error: 'Result missing and could not be fetched from Manus API' },
          { status: 500 }
        );
      }
    }

    // Get current phase from company_report metadata
    const reportData = companyProfile.company_report || {};
    const currentPhase = (reportData.current_phase || 'phase_1_company_report') as WorkflowPhase;
    const phasesCompleted = reportData.phases_completed || [];
    const phaseDataStore = reportData.phase_data || {};

    // Update company profile based on status
    let workflowStatus = companyProfile.workflow_status;
    let updateData: any = {};

    // Check if this is a successful task completion
    // Manus sends event_type='task_stopped' with stop_reason='finish' for completed tasks
    const isTaskCompleted = eventType === 'task_stopped' && (stopReason === 'finish' || stopReason === 'end_turn');

    if (isTaskCompleted) {
      console.log('[Manus Webhook] Phase completed:', {
        currentPhase,
        hasResult: !!result,
        resultType: typeof result,
        resultIsNull: result === null,
        resultIsUndefined: result === undefined,
      });

      // Phase completed - store result
      // If result is missing, try to fetch it from Manus API
      let finalResult = result;

      // Check if result is empty or just a string "completed" which sometimes happens
      const isResultEmpty = result === null || result === undefined || (typeof result === 'string' && result.trim() === '');

      if (isResultEmpty) {
        console.warn('[Manus Webhook] Result is missing from webhook payload. Attempting to fetch from Manus API...');

        try {
          const taskStatus = await getManusTaskStatus(task_id);

          if (taskStatus.status === 'completed' && taskStatus.result) {
            console.log('[Manus Webhook] Successfully fetched result from Manus API');
            finalResult = taskStatus.result;
          } else {
            // Try alternative fields
            const altResult = (taskStatus as any).output || (taskStatus as any).data || (taskStatus as any).content;
            if (altResult) {
              console.log('[Manus Webhook] Found result in alternative field from API');
              finalResult = altResult;
            } else {
              console.error('[Manus Webhook] Could not fetch result from Manus API:', {
                status: taskStatus.status,
                hasResult: !!taskStatus.result,
              });
            }
          }
        } catch (fetchError) {
          console.error('[Manus Webhook] Error fetching result from Manus API:', fetchError);
        }
      }

      // Check if we have a result now
      if (finalResult === null || finalResult === undefined || (typeof finalResult === 'string' && finalResult.trim() === '')) {
        console.warn('[Manus Webhook] No result available. Will be fetched later via status polling.');
        // Don't return error - just update the phase status without result
        // The result can be fetched later via the status endpoint
        workflowStatus = mapPhaseToWorkflowStatus(currentPhase);
        updateData = {
          workflow_status: workflowStatus,
          company_report: {
            current_phase: currentPhase,
            phases_completed: phasesCompleted,
            phase_data: phaseDataStore, // Keep existing phase_data
          },
        };
      } else {
        let candidateResult = finalResult;
        if (Array.isArray(candidateResult)) {
          console.log('[Manus Webhook] Result is an array of messages, length:', candidateResult.length);

          // Determine target key based on phase to help find the right message
          let targetKey: string | undefined;
          if (currentPhase === 'phase_2_icp_report') {
            targetKey = 'icp_reports';
          } else if (currentPhase === 'phase_3_campaigns') {
            targetKey = 'campaign_blueprints';
          } else if (currentPhase === 'phase_1_company_report') {
            targetKey = 'client_offer_brief';
          }

          const assistantMessage = findBestAssistantMessage(candidateResult, targetKey);

          if (assistantMessage) {
            console.log('[Manus Webhook] Selected assistant message with role:', assistantMessage?.role);
            candidateResult = assistantMessage;
          } else {
            console.log('[Manus Webhook] No suitable assistant message found, using last message');
            candidateResult = candidateResult[candidateResult.length - 1];
          }
        }

        const structuredReport = await parseManusReportPayload(candidateResult);
        let normalizedResult = structuredReport ?? candidateResult;

        const isUserMessage = normalizedResult && typeof normalizedResult === 'object' && !Array.isArray(normalizedResult) && normalizedResult.role === 'user';

        if (structuredReport) {
          console.log('[Manus Webhook] Structured report extracted from Manus payload.');
          normalizedResult = structuredReport;
        } else {
          console.warn('[Manus Webhook] Structured report not found in payload. Storing raw result for debugging purposes.');
        }

        console.log('[Manus Webhook] Normalized phase result summary:', {
          phase: currentPhase,
          isArray: Array.isArray(normalizedResult),
          isObject: typeof normalizedResult === 'object' && normalizedResult !== null && !Array.isArray(normalizedResult),
          hasReportShape: hasManusReportShape(normalizedResult),
          preview: typeof normalizedResult === 'string'
            ? normalizedResult.substring(0, 200)
            : JSON.stringify(normalizedResult).substring(0, 200),
        });

        // Store the result in phase_data (only if it's not a user message)
        if (normalizedResult && (!isUserMessage)) {
          phaseDataStore[currentPhase] = normalizedResult;

          // Add to phases_completed if not already there
          if (!phasesCompleted.includes(currentPhase)) {
            phasesCompleted.push(currentPhase);
          }
        } else if (isUserMessage) {
          console.warn('[Manus Webhook] Result is a user message (input prompt), skipping storage. Will rely on manual fetch.');
        }

        console.log('[Manus Webhook] Updated phaseDataStore:', {
          phasesCompleted,
          phaseDataKeys: Object.keys(phaseDataStore),
          phaseDataStoreSize: JSON.stringify(phaseDataStore).length,
        });

        const currentPhaseConfig = WORKFLOW_PHASES[currentPhase];
        const nextPhase = currentPhaseConfig?.nextPhase;

        // Phase 1 does NOT auto-advance - requires manual approval
        if (currentPhase === 'phase_1_company_report') {
          // Just store the result, don't advance
          workflowStatus = 'reviewing'; // Set to reviewing state for manual approval
          updateData = {
            workflow_status: workflowStatus,
            company_report: {
              current_phase: currentPhase,
              phases_completed: phasesCompleted,
              phase_data: phaseDataStore,
            },
          };

          console.log('[Manus Webhook] Phase 1 completed - updateData:', {
            workflow_status: workflowStatus,
            company_report_keys: Object.keys(updateData.company_report || {}),
          });
        } else if (currentPhase === 'phase_2_icp_report') {
          // TEMPORARILY DISABLED: Phase 2 does NOT auto-advance to Phase 3
          // Store the result and wait for manual trigger
          workflowStatus = 'icp_ready'; // New status: ICP generated, ready for campaign creation
          updateData = {
            workflow_status: workflowStatus,
            company_report: {
              current_phase: currentPhase,
              phases_completed: phasesCompleted,
              phase_data: phaseDataStore,
            },
          };

          console.log('[Manus Webhook] Phase 2 completed - NOT auto-advancing to Phase 3 (temporarily disabled)');
        } else if (currentPhase === 'phase_3_campaigns') {
          // TEMPORARILY DISABLED: Phase 3 does NOT auto-advance to Phase 4
          // Store the result and wait for manual trigger or decision
          workflowStatus = 'campaigns_ready'; // New status: Campaigns generated
          updateData = {
            workflow_status: workflowStatus,
            company_report: {
              current_phase: currentPhase,
              phases_completed: phasesCompleted,
              phase_data: phaseDataStore,
            },
          };

          console.log('[Manus Webhook] Phase 3 completed - NOT auto-advancing to Phase 4 (temporarily disabled)');
        } else if (nextPhase && nextPhase !== 'completed') {
          // Auto-advance for phases 3-5 (when Phase 3 is re-enabled)
          const nextPhaseConfig = WORKFLOW_PHASES[nextPhase];

          // Build prompt for next phase
          let nextPhasePrompt: string;

          if (nextPhase === 'phase_2_icp_report') {
            nextPhasePrompt = nextPhaseConfig.promptBuilder({
              companyReport: phaseDataStore.phase_1_company_report,
            });
          } else if (nextPhase === 'phase_3_campaigns') {
            nextPhasePrompt = nextPhaseConfig.promptBuilder({
              companyReport: phaseDataStore.phase_1_company_report,
              icpReport: phaseDataStore.phase_2_icp_report,
            });
          } else {
            nextPhasePrompt = '';
          }

          // Continue the same task with next phase
          try {
            console.log(`[Manus Webhook] Auto-advancing to ${nextPhase}`);
            await continueManusTask(task_id, nextPhasePrompt);
          } catch (continueError) {
            console.error('[Manus Webhook] Error continuing to next phase:', continueError);
          }

          workflowStatus = mapPhaseToWorkflowStatus(nextPhase);
          updateData = {
            workflow_status: workflowStatus,
            company_report: {
              current_phase: nextPhase,
              phases_completed: phasesCompleted,
              phase_data: phaseDataStore,
            },
          };
        } else {
          // All phases completed
          workflowStatus = 'completed';
          updateData = {
            workflow_status: 'completed',
            company_report: {
              current_phase: 'completed',
              phases_completed: phasesCompleted,
              phase_data: phaseDataStore,
              final_report: finalResult,
            },
            completed_at: new Date().toISOString(),
          };
        }
      }
    } else if (status === 'failed') {
      workflowStatus = 'failed';
      updateData = {
        workflow_status: 'failed',
      };
    } else if (status === 'running') {
      // Task is running - keep current status
      updateData = {
        workflow_status: workflowStatus,
      };
    }

    // Update the company profile
    const { error: updateError, data: updatedProfile } = await supabaseAdmin
      .from('company_profiles')
      .update(updateData)
      .eq('id', companyProfile.id)
      .select()
      .single();

    if (updateError) {
      console.error('[Manus Webhook] Error updating company profile:', updateError);
      return NextResponse.json({ error: 'Failed to update company profile' }, { status: 500 });
    }

    console.log('[Manus Webhook] Updated company profile:', {
      id: updatedProfile?.id,
      workflow_status: updatedProfile?.workflow_status,
      hasCompanyReport: !!updatedProfile?.company_report,
      phaseDataKeys: Object.keys(updatedProfile?.company_report?.phase_data || {}),
    });


    return NextResponse.json({ success: true, updated: true });

  } catch (error) {
    console.error('[Manus Webhook] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

