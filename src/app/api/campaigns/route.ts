/**
 * API Route: /api/campaigns
 * 
 * Fetch campaigns for a specific project or user
 * Returns campaigns with PlusVibe sync status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with Service Role Key for admin access
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
    try {
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
        let query = supabaseAdmin
            .from('campaigns')
            .select(`
                *,
                projects!inner (
                    id,
                    name,
                    company_profile_id
                ),
                email_templates (
                    id,
                    name,
                    subject,
                    body_text,
                    sequence_position,
                    variables,
                    template_type
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

        // Format response with sync status and sequence
        const formattedCampaigns = (campaigns || []).map((campaign: any) => {
            // Map email_templates to sequence
            const sequence = (campaign.email_templates || [])
                .sort((a: any, b: any) => (a.sequence_position || 0) - (b.sequence_position || 0))
                .map((template: any) => ({
                    step_number: template.sequence_position,
                    wait_days: template.variables?.wait_days || 0,
                    step_summary: template.name,
                    variations: [
                        {
                            variation_id: template.id,
                            subject: template.subject,
                            body: template.body_text
                        }
                    ]
                }));

            return {
                ...campaign,
                // Extract project info
                project_name: campaign.projects?.name,
                // Compute sync display info
                is_synced: campaign.sync_with_plusvibe || false,
                sync_status_display: getSyncStatusDisplay(campaign),
                last_sync_display: campaign.last_plusvibe_sync
                    ? new Date(campaign.last_plusvibe_sync).toLocaleString()
                    : null,
                sequence: sequence
            };
        });

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

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { project_id, user_id, name, description, status, sequence, icp_id } = body;

        if (!project_id || !name) {
            return NextResponse.json({ error: 'project_id and name are required' }, { status: 400 });
        }

        // 1. Create Campaign
        const { data: campaign, error: campaignError } = await supabaseAdmin
            .from('campaigns')
            .insert({
                project_id,
                user_id, // Optional, if available
                name,
                description,
                status: status || 'draft',
                icp_id,
                total_leads: 0,
                total_sent: 0,
                total_replies: 0,
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (campaignError) {
            console.error('Error creating campaign:', campaignError);
            return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
        }

        // 2. Create Email Templates (Sequence Steps)
        if (sequence && Array.isArray(sequence) && sequence.length > 0) {
            const templatesToInsert = sequence.map((step: any, index: number) => {
                // Assuming first variation is the main one for now
                const variation = step.variations?.[0] || {};

                return {
                    project_id,
                    user_id,
                    campaign_id: campaign.id,
                    name: step.step_summary || `Step ${step.step_number}`,
                    subject: variation.subject || '',
                    body_text: variation.body || '',
                    sequence_position: step.step_number || index + 1,
                    template_type: 'outreach',
                    variables: {
                        wait_days: step.wait_days || 0
                    },
                    is_active: true
                };
            });

            const { error: templatesError } = await supabaseAdmin
                .from('email_templates')
                .insert(templatesToInsert);

            if (templatesError) {
                console.error('Error creating email templates:', templatesError);
                // Note: We might want to delete the campaign if templates fail, 
                // but for now we'll just report the error.
                return NextResponse.json({
                    campaign,
                    warning: 'Campaign created but templates failed',
                    error: templatesError.message
                }, { status: 201 });
            }
        }

        return NextResponse.json({ success: true, campaign }, { status: 201 });

    } catch (error) {
        console.error('Unexpected error in POST:', error);
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
