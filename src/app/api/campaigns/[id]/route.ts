import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { deleteCampaign, PlusVibeClientCredentials } from '@/lib/plusvibe';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Admin client for bypassing RLS
const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        cookies: {
            async get() { return null },
            async set() { },
            async remove() { },
        },
    }
);

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: campaignId } = await params;
        const body = await request.json();
        const { name, description, status, sequence, icp_id } = body;

        const supabase = await createServerSupabaseClient();

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify ownership
        const { data: existingCampaign, error: fetchError } = await supabase
            .from('campaigns')
            .select('user_id')
            .eq('id', campaignId)
            .single();

        if (fetchError || !existingCampaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }

        if (existingCampaign.user_id !== user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Update campaign metadata using admin client
        const { data: campaign, error: campaignError } = await supabaseAdmin
            .from('campaigns')
            .update({
                name,
                description,
                status,
                icp_id,
                updated_at: new Date().toISOString(),
            })
            .eq('id', campaignId)
            .select()
            .single();

        if (campaignError) {
            console.error('[API Campaigns PATCH] Error updating campaign:', campaignError);
            return NextResponse.json(
                { error: 'Failed to update campaign' },
                { status: 500 }
            );
        }

        // If sequence is provided, update email templates
        if (sequence && Array.isArray(sequence)) {
            // Delete existing templates
            const { error: deleteError } = await supabaseAdmin
                .from('email_templates')
                .delete()
                .eq('campaign_id', campaignId);

            if (deleteError) {
                console.error('[API Campaigns PATCH] Error deleting old templates:', deleteError);
                return NextResponse.json(
                    { error: 'Failed to update email templates' },
                    { status: 500 }
                );
            }

            // Create new templates
            const templates = sequence.map((step: any, index: number) => ({
                campaign_id: campaignId,
                name: step.step_summary || `Step ${step.step_number}`,
                subject: step.variations?.[0]?.subject || '',
                body_text: step.variations?.[0]?.body || '',
                sequence_position: index + 1,
                variables: {
                    wait_days: step.wait_days || 0,
                    step_number: step.step_number,
                },
            }));

            const { error: insertError } = await supabaseAdmin
                .from('email_templates')
                .insert(templates);

            if (insertError) {
                console.error('[API Campaigns PATCH] Error creating templates:', insertError);
                return NextResponse.json(
                    { error: 'Failed to create email templates' },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json({
            success: true,
            campaign,
        });
    } catch (error) {
        console.error('[API Campaigns PATCH] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createServerSupabaseClient();

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch the campaign to verify ownership and get PlusVibe details
        const { data: campaign, error: fetchError } = await supabase
            .from('campaigns')
            .select('id, user_id, plusvibe_campaign_id, plusvibe_workspace_id')
            .eq('id', id)
            .single();

        if (fetchError || !campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }

        // Verify ownership
        if (campaign.user_id !== user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Delete from PlusVibe if linked
        if (campaign.plusvibe_campaign_id && campaign.plusvibe_workspace_id) {
            try {
                // We need the API key for this workspace. 
                // We can either fetch it from the connection table or assume it's the default if not custom.
                // For now, let's try to fetch the connection details.

                const { data: connection } = await supabase
                    .from('plusvibe_connections')
                    .select('api_key')
                    .eq('workspace_id', campaign.plusvibe_workspace_id)
                    .eq('user_id', user.id)
                    .single();

                const credentials: PlusVibeClientCredentials | undefined = connection
                    ? { workspaceId: campaign.plusvibe_workspace_id, apiKey: connection.api_key }
                    : undefined; // Fallback to env vars if not found (standard workspace)

                await deleteCampaign(campaign.plusvibe_campaign_id, credentials);
            } catch (pvError) {
                console.error('Failed to delete from PlusVibe:', pvError);
                // Proceed to delete locally even if PV fails, but maybe warn?
                // For now, we'll treat it as a soft failure and proceed.
            }
        }

        // Delete from local database
        const { error: deleteError } = await supabase
            .from('campaigns')
            .delete()
            .eq('id', id);

        if (deleteError) {
            throw deleteError;
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Delete campaign error:', error);
        return NextResponse.json(
            { error: 'Failed to delete campaign' },
            { status: 500 }
        );
    }
}
