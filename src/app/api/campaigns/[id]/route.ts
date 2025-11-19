import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { deleteCampaign, PlusVibeClientCredentials } from '@/lib/plusvibe';

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
