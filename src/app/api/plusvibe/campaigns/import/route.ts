/**
 * API Route: /api/plusvibe/campaigns/import
 * Import campaigns from PlusVibe into local database
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { importCampaignFromPlusVibe } from '@/lib/plusvibe-sync';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse request body
        const body = await request.json();
        const {
            plusvibeCampaignId,
            projectId,
            connectionId,
            includeLeads = true,
            includeEmails = true,
            includeReplies = true,
            autoSync = true,
        } = body;

        // Validate required fields
        if (!plusvibeCampaignId || !projectId || !connectionId) {
            return NextResponse.json(
                { error: 'plusvibeCampaignId, projectId, and connectionId are required' },
                { status: 400 }
            );
        }

        // Verify project belongs to user
        const { data: project } = await supabase
            .from('projects')
            .select('id')
            .eq('id', projectId)
            .eq('user_id', user.id)
            .single();

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Verify connection belongs to user
        const { data: connection } = await supabase
            .from('plusvibe_connections')
            .select('id')
            .eq('id', connectionId)
            .eq('user_id', user.id)
            .single();

        if (!connection) {
            return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
        }

        // Import campaign
        const result = await importCampaignFromPlusVibe({
            plusvibeCampaignId,
            projectId,
            userId: user.id,
            connectionId,
            includeLeads,
            includeEmails,
            includeReplies,
            autoSync,
        });

        return NextResponse.json({
            success: result.success,
            campaignId: result.campaignId,
            syncHistoryId: result.syncHistoryId,
            stats: {
                itemsProcessed: result.itemsProcessed,
                itemsSuccessful: result.itemsSuccessful,
                itemsFailed: result.itemsFailed,
            },
            errors: result.errors,
        });
    } catch (error) {
        console.error('Campaign import error:', error);
        return NextResponse.json(
            {
                error: 'Failed to import campaign',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
