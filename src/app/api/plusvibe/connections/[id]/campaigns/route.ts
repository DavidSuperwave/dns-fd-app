/**
 * API Route: Get campaigns for a specific connection
 * Used in custom workspace setup to show available campaigns for import
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { fetchCampaigns } from '@/lib/plusvibe';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const supabase = await createServerSupabaseClient();

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const connectionId = id;

        // Get connection details
        const { data: connection, error: connError } = await supabase
            .from('plusvibe_connections')
            .select('workspace_id, api_key')
            .eq('id', connectionId)
            .eq('user_id', user.id)
            .single();

        if (connError || !connection) {
            return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
        }

        // Fetch campaigns from PlusVibe
        const campaigns = await fetchCampaigns(
            {},
            {
                workspaceId: connection.workspace_id,
                apiKey: connection.api_key,
            }
        );

        return NextResponse.json({ campaigns });

    } catch (error) {
        console.error('Error fetching campaigns for connection:', error);
        return NextResponse.json(
            { error: 'Failed to fetch campaigns', message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
