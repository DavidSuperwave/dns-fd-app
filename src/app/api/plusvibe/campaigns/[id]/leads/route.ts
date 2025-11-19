/**
 * API Route: /api/plusvibe/campaigns/[id]/leads
 * Add leads to a campaign
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { addLeadsToCampaign, PlusVibeClientCredentials } from '@/lib/plusvibe';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const supabase = await createServerSupabaseClient();

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse request body
        const body = await request.json();
        const { leads } = body;

        if (!leads || !Array.isArray(leads) || leads.length === 0) {
            return NextResponse.json(
                { error: 'Leads array is required' },
                { status: 400 }
            );
        }

        // 1. Get the campaign associated with this project
        // We assume the project has an active campaign linked
        const { data: campaign } = await supabase
            .from('campaigns')
            .select('*')
            .eq('project_id', projectId)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!campaign) {
            return NextResponse.json({ error: 'No campaign found for this project' }, { status: 404 });
        }

        if (!campaign.plusvibe_campaign_id) {
            return NextResponse.json({ error: 'Campaign is not linked to PlusVibe' }, { status: 400 });
        }

        // 2. Get credentials
        // We need to find the connection used for this campaign
        // For now, we'll look up the connection by workspace_id if stored, or use the default for the user/project
        // A better approach would be to store connection_id on the campaign table, but for now let's try to find it

        let credentials: PlusVibeClientCredentials | undefined;

        if (campaign.plusvibe_workspace_id) {
            const { data: connection } = await supabase
                .from('plusvibe_connections')
                .select('*')
                .eq('workspace_id', campaign.plusvibe_workspace_id)
                .eq('user_id', user.id)
                .single();

            if (connection) {
                credentials = {
                    workspaceId: connection.workspace_id,
                    apiKey: connection.api_key,
                };
            }
        }

        // Fallback to default connection if not found
        if (!credentials) {
            const { data: defaultConnection } = await supabase
                .from('plusvibe_connections')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_default', true)
                .single();

            if (defaultConnection) {
                credentials = {
                    workspaceId: defaultConnection.workspace_id,
                    apiKey: defaultConnection.api_key,
                };
            }
        }

        if (!credentials) {
            return NextResponse.json({ error: 'PlusVibe credentials not found' }, { status: 400 });
        }

        // 3. Add leads to PlusVibe
        const result = await addLeadsToCampaign(
            campaign.plusvibe_campaign_id,
            leads,
            credentials
        );

        // 4. Store leads locally (optional, but good for sync)
        // We'll do this asynchronously or just rely on the result for now
        // To keep it simple and fast, we'll just return the PlusVibe result
        // and let the background sync (if implemented) handle the local storage
        // OR we can insert them now. Let's insert them now for immediate feedback.

        const localLeads = leads.map((lead: any) => ({
            user_id: user.id,
            project_id: projectId,
            campaign_id: campaign.id,
            name: lead.name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
            email: lead.email,
            company: lead.company,
            title: lead.title,
            phone: lead.phone,
            website: lead.website,
            source: 'upload',
            status: 'new',
            // Store extra fields in a jsonb column if it exists, or ignore
        }));

        // Batch insert local leads (ignoring duplicates if possible)
        const { error: insertError } = await supabase
            .from('leads')
            .upsert(localLeads, { onConflict: 'email, campaign_id', ignoreDuplicates: true });

        if (insertError) {
            console.warn('Failed to save leads locally:', insertError);
        }

        return NextResponse.json({
            success: true,
            successful: result.successful,
            failed: result.failed,
            errors: result.errors,
        });

    } catch (error) {
        console.error('Add leads error:', error);
        return NextResponse.json(
            {
                error: 'Failed to add leads',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
