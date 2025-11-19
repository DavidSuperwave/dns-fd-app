/**
 * API Route: /api/plusvibe/campaigns/create
 * Create a new campaign in PlusVibe and sync it locally
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { exportCampaignToPlusVibe } from '@/lib/plusvibe-sync';
import { createPlusVibeCampaign, PlusVibeClientCredentials } from '@/lib/plusvibe';

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
            projectId,
            connectionId,
            name,
            description,
            fromName,
            fromEmail
        } = body;

        // Validate required fields
        if (!projectId || !connectionId || !name) {
            return NextResponse.json(
                { error: 'projectId, connectionId, and name are required' },
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
            .select('*')
            .eq('id', connectionId)
            .eq('user_id', user.id)
            .single();

        if (!connection) {
            return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
        }

        const credentials: PlusVibeClientCredentials = {
            workspaceId: connection.workspace_id,
            apiKey: connection.api_key,
        };

        // 1. Create campaign in PlusVibe
        const pvCampaign = await createPlusVibeCampaign(
            {
                name,
                description,
                fromName,
                fromEmail,
            },
            credentials
        );

        if (!pvCampaign || !pvCampaign.id) {
            throw new Error('Failed to create campaign in PlusVibe');
        }

        // 2. Create local campaign record
        const { data: localCampaign, error: campaignError } = await supabase
            .from('campaigns')
            .insert({
                user_id: user.id,
                project_id: projectId,
                name: pvCampaign.name,
                description: description,
                status: 'draft',
                plusvibe_campaign_id: pvCampaign.id,
                plusvibe_workspace_id: connection.workspace_id,
                sync_with_plusvibe: true,
                auto_sync_enabled: true,
                plusvibe_sync_status: 'synced',
                last_plusvibe_sync: new Date().toISOString(),
                from_name: fromName,
                from_email: fromEmail,
            })
            .select()
            .single();

        if (campaignError) {
            console.error('Failed to create local campaign:', campaignError);
            // We still return success because the PV campaign was created, 
            // but we warn the user or just return the PV ID.
            // Ideally we should try to rollback or handle this better, but for now:
            throw new Error('Created in PlusVibe but failed to save locally: ' + campaignError.message);
        }

        return NextResponse.json({
            success: true,
            campaignId: localCampaign.id,
            plusvibeCampaignId: pvCampaign.id,
            campaign: localCampaign,
        });

    } catch (error) {
        console.error('Campaign creation error:', error);
        return NextResponse.json(
            {
                error: 'Failed to create campaign',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
