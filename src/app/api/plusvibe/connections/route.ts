/**
 * API Route: /api/plusvibe/connections
 * Manage PlusVibe API connections for users
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch user's PlusVibe connections
        const { data: connections, error } = await supabase
            .from('plusvibe_connections')
            .select('id, connection_name, workspace_id, is_active, is_default, last_sync_at, last_sync_status, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching connections:', error);
            return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
        }

        return NextResponse.json({ connections });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

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
        const { workspace_id, api_key, connection_name, is_default = false } = body;

        // Validate required fields
        if (!workspace_id || !api_key) {
            return NextResponse.json(
                { error: 'workspace_id and api_key are required' },
                { status: 400 }
            );
        }

        // If setting as default, unset other defaults
        if (is_default) {
            await supabase
                .from('plusvibe_connections')
                .update({ is_default: false })
                .eq('user_id', user.id);
        }

        // Create connection
        const { data: connection, error } = await supabase
            .from('plusvibe_connections')
            .insert({
                user_id: user.id,
                workspace_id,
                api_key, // TODO: Encrypt in production
                connection_name: connection_name || `PlusVibe - ${workspace_id}`,
                is_active: true,
                is_default,
            })
            .select('id, connection_name, workspace_id, is_active, is_default, created_at')
            .single();

        if (error) {
            // Check for unique constraint violation
            if (error.code === '23505') {
                return NextResponse.json(
                    { error: 'Connection for this workspace already exists' },
                    { status: 409 }
                );
            }
            console.error('Error creating connection:', error);
            return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 });
        }

        return NextResponse.json({ connection }, { status: 201 });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
