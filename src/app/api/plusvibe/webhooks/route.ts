/**
 * API Route: /api/plusvibe/webhooks
 * Handle webhook events from PlusVibe
 * 
 * Supported events:
 * - FIRST_EMAIL_REPLIES
 * - ALL_EMAIL_REPLIES
 * - ALL_POSITIVE_REPLIES
 * - LEAD_MARKED_AS_INTERESTED
 * - EMAIL_SENT
 * - BOUNCED_EMAIL
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Parse webhook payload
        const payload = await request.json();
        const { event_type, data, campaign_id, workspace_id } = payload;

        console.log('[PlusVibe Webhook] Received:', event_type, 'for campaign:', campaign_id);

        // TODO: Verify webhook signature for security
        // const signature = request.headers.get('x-plusvibe-signature');
        // if (!verifySignature(signature, payload)) {
        //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        // }

        // Find the local campaign linked to this PlusVibe campaign
        const { data: campaign } = await supabase
            .from('campaigns')
            .select('id, user_id, project_id')
            .eq('plusvibe_campaign_id', campaign_id)
            .eq('plusvibe_workspace_id', workspace_id)
            .single();

        if (!campaign) {
            console.warn('[PlusVibe Webhook] Campaign not found:', campaign_id);
            return NextResponse.json({ message: 'Campaign not found, ignoring' }, { status: 200 });
        }

        // Handle different event types
        switch (event_type) {
            case 'FIRST_EMAIL_REPLIES':
            case 'ALL_EMAIL_REPLIES':
            case 'ALL_POSITIVE_REPLIES':
                await handleEmailReply(supabase, campaign, data);
                break;

            case 'LEAD_MARKED_AS_INTERESTED':
                await handleLeadInterested(supabase, campaign, data);
                break;

            case 'EMAIL_SENT':
                await handleEmailSent(supabase, campaign, data);
                break;

            case 'BOUNCED_EMAIL':
                await handleBouncedEmail(supabase, campaign, data);
                break;

            default:
                console.log('[PlusVibe Webhook] Unknown event type:', event_type);
        }

        // Update campaign last sync time
        await supabase
            .from('campaigns')
            .update({ last_plusvibe_sync: new Date().toISOString() })
            .eq('id', campaign.id);

        return NextResponse.json({ success: true, message: 'Webhook processed' });
    } catch (error) {
        console.error('[PlusVibe Webhook] Error:', error);
        return NextResponse.json(
            { error: 'Failed to process webhook' },
            { status: 500 }
        );
    }
}

// Handle email reply webhook
async function handleEmailReply(supabase: any, campaign: any, data: any) {
    try {
        const { from_email, from_name, to_email, subject, body, thread_id, message_id, received_at } = data;

        // Check if reply already exists
        const { data: existing } = await supabase
            .from('email_replies')
            .select('id')
            .eq('message_id', message_id)
            .single();

        if (existing) {
            console.log('[Webhook] Reply already exists:', message_id);
            return;
        }

        // Find corresponding lead
        const { data: lead } = await supabase
            .from('leads')
            .select('id')
            .eq('campaign_id', campaign.id)
            .eq('email', from_email)
            .single();

        // Insert email reply
        await supabase.from('email_replies').insert({
            user_id: campaign.user_id,
            project_id: campaign.project_id,
            campaign_id: campaign.id,
            lead_id: lead?.id,
            from_email,
            from_name,
            to_email,
            subject,
            body_text: body,
            thread_id,
            message_id,
            source: 'vibe_plus',
            source_data: data,
            status: 'new',
            received_at: received_at || new Date().toISOString(),
        });

        console.log('[Webhook] Email reply saved:', message_id);
    } catch (error) {
        console.error('[Webhook] Error saving email reply:', error);
    }
}

// Handle lead marked as interested
async function handleLeadInterested(supabase: any, campaign: any, data: any) {
    try {
        const { email, label } = data;

        await supabase
            .from('leads')
            .update({ status: 'qualified', notes: `Marked as ${label} via PlusVibe` })
            .eq('campaign_id', campaign.id)
            .eq('email', email);

        console.log('[Webhook] Lead marked as interested:', email);
    } catch (error) {
        console.error('[Webhook] Error updating lead:', error);
    }
}

// Handle email sent event
async function handleEmailSent(supabase: any, campaign: any, data: any) {
    try {
        const { to_email, subject, message_id, sent_at } = data;

        // Update campaign total_sent counter
        await supabase.rpc('increment_campaign_sent_count', { campaign_id_param: campaign.id });

        console.log('[Webhook] Email sent recorded:', to_email);
    } catch (error) {
        console.error('[Webhook] Error recording email sent:', error);
    }
}

// Handle bounced email
async function handleBouncedEmail(supabase: any, campaign: any, data: any) {
    try {
        const { email, bounce_reason } = data;

        // Mark lead as lost due to bounce
        await supabase
            .from('leads')
            .update({ status: 'lost', notes: `Email bounced: ${bounce_reason}` })
            .eq('campaign_id', campaign.id)
            .eq('email', email);

        console.log('[Webhook] Bounced email handled:', email);
    } catch (error) {
        console.error('[Webhook] Error handling bounced email:', error);
    }
}
