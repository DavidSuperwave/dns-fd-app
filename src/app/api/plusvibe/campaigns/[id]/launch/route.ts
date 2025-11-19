/**
 * API Route: /api/plusvibe/campaigns/[id]/launch
 * Launch/export a local campaign to PlusVibe
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { exportCampaignToPlusVibe } from '@/lib/plusvibe-sync';
import { activateCampaign } from '@/lib/plusvibe';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const supabase = createRouteHandlerClient({ cookies });

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const campaignId = params.id;

        // Parse request body
        const body = await request.json();
        const {
            connectionId,
            createNew = false,
            includeLeads = true,
            includeEmails = true,
            activateImmediately = false,
        } = body;

        // Validate required fields
        if (!connectionId) {
            return NextResponse.json({ error: 'connectionId is required' }, { status: 400 });
        }

        // Verify campaign belongs to user
        const { data: campaign } = await supabase
            .from('campaigns')
            .select('id, name, plusvibe_campaign_id')
            .eq('id', campaignId)
            .eq('user_id', user.id)
            .single();

        if (!campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }

        // Perform the export
        const result = await exportCampaignToPlusVibe({
            campaignId,
            userId: user.id,
            connectionId,
            createNew,
            includeLeads,
            includeEmails,
        });

        if (!result.success) {
            return NextResponse.json({
                error: 'Export failed',
                details: result.errors,
            }, { status: 500 });
        }

        // Optionally activate the campaign
        if (activateImmediately && result.plusvibeCampaignId) {
            let apiKey = process.env.PLUSVIBE_API_KEY;
            let workspaceId = process.env.PLUSVIBE_WORKSPACE_ID;

            if (connectionId !== 'standard') {
                const { data: conn } = await supabase
                    .from('plusvibe_connections')
                    .select('workspace_id, api_key')
                    .eq('id', connectionId)
                    .single();

                if (conn) {
                    apiKey = conn.api_key;
                    workspaceId = conn.workspace_id;
                }
            }

            if (apiKey && workspaceId) {
                try {
                    await activateCampaign(result.plusvibeCampaignId, {
                        workspaceId,
                        apiKey,
                    });

                    // Update campaign status in local database
                    await supabase
                        .from('campaigns')
                        .update({ status: 'active' })
                        .eq('id', campaignId);
                } catch (error) {
                    console.error('Failed to activate campaign:', error);
                    // Don't fail the whole request if activation fails
                }
            }
        }

        return NextResponse.json({
            success: result.success,
            campaignId: result.campaignId,
            plusvibeCampaignId: result.plusvibeCampaignId,
            syncHistoryId: result.syncHistoryId,
            stats: {
                itemsProcessed: result.itemsProcessed,
                itemsSuccessful: result.itemsSuccessful,
                itemsFailed: result.itemsFailed,
            },
            errors: result.errors,
        });

    } catch (error) {
        console.error('Campaign launch error:', error);
        return NextResponse.json(
            {
                error: 'Failed to launch campaign',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
