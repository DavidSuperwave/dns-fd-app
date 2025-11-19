import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const resolvedCookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return resolvedCookieStore.get(name)?.value;
                },
                set() { },
                remove() { },
            },
        }
    );

    try {
        // Verify user is authenticated
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const body = await request.json();
        const { phaseData } = body;

        if (!phaseData) {
            return NextResponse.json({ error: 'Missing phaseData' }, { status: 400 });
        }

        // Update company profile with manual data
        const { error: updateError } = await supabaseAdmin
            .from('company_profiles')
            .update({
                workflow_status: 'reviewing',
                company_report: {
                    current_phase: 'phase_1_company_report',
                    phases_completed: [],
                    phase_data: {
                        phase_1_company_report: phaseData
                    },
                },
            })
            .eq('id', id);

        if (updateError) {
            console.error('[Manual Override] Database error:', updateError);
            return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[Manual Override] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
