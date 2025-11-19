/**
 * API Route: /api/campaigns
 * 
 * Fetch campaigns for a specific project or user
 * Returns campaigns with PlusVibe sync status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get query parameters
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('project_id');
        const userId = searchParams.get('user_id');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        if (!userId && !projectId) {
            return NextResponse.json({ error: 'user_id or project_id required' }, { status: 400 });
        }

        // Build query
        let query = supabase
            .from('campaigns')
            .select(`
        id,
        project_id,
        user_id,
        name,
        description,
        status,
        total_leads,
        total_sent,
        total_replies,
        plusvibe_campaign_id,
        plusvibe_workspace_id,
        sync_with_plusvibe,
        last_plusvibe_sync,
        plusvibe_sync_status,
        plusvibe_sync_direction,
        plusvibe_sync_error,
        auto_sync_enabled,
        created_at,
        updated_at,
        projects!inner (
          id,
          name,
          company_profile_id
        )
      `)
            .order('updated_at', { ascending: false })
            .range(offset, offset + limit - 1);

        // Filter by project or user
        if (projectId) {
            query = query.eq('project_id', projectId);
        } else if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data: campaigns, error, count } = await query;

        if (error) {
            console.error('Error fetching campaigns:', error);
            return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
        }

        // Format response with sync status
        const formattedCampaigns = (campaigns || []).map((campaign: any) => ({
            ...campaign,
            // Extract project info
            project_name: campaign.projects?.name,
            // Compute sync display info
            is_synced: campaign.sync_with_plusvibe || false,
            sync_status_display: getSyncStatusDisplay(campaign),
            last_sync_display: campaign.last_plusvibe_sync
                ? new Date(campaign.last_plusvibe_sync).toLocaleString()
                : null,
        }));

        return NextResponse.json({
            campaigns: formattedCampaigns,
            count: formattedCampaigns.length,
            total: count,
            has_more: offset + limit < (count || 0),
        });

    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

function getSyncStatusDisplay(campaign: any): string {
    if (!campaign.sync_with_plusvibe) {
        return 'Not synced';
    }

    switch (campaign.plusvibe_sync_status) {
        case 'synced':
            return 'Synced';
        case 'syncing':
            return 'Syncing...';
        case 'pending':
            return 'Pending sync';
        case 'error':
            return 'Sync error';
        default:
            return 'Unknown';
    }
}
