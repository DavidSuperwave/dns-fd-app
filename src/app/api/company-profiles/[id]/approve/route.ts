/**
 * Approve Phase 1 report without starting Phase 2
 * Phase 2 will be manually triggered from the ICP tab
 */
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

    // Create Supabase client for auth check
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

        // Get company profile
        const { data: companyProfile, error: fetchError } = await supabaseAdmin
            .from('company_profiles')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (fetchError || !companyProfile) {
            return NextResponse.json({ error: 'Company profile not found' }, { status: 404 });
        }

        // Update status to 'approved' (ready for Phase 2 when user clicks Generate ICP)
        const reportData = companyProfile.company_report || {};
        const body = await request.json().catch(() => ({}));
        const { updatedReportData } = body;

        // If updated data is provided, merge it into the existing report
        let finalReportData = reportData;
        if (updatedReportData) {
            finalReportData = {
                ...reportData,
                phase_data: {
                    ...reportData.phase_data,
                    phase_1_company_report: updatedReportData
                }
            };
        }

        await supabaseAdmin
            .from('company_profiles')
            .update({
                workflow_status: 'approved', // New status: approved but not yet generating Phase 2
                company_report: {
                    ...finalReportData,
                    phase_1_approved: true,
                },
            })
            .eq('id', id);

        // Update associated project status to 'active'
        await supabaseAdmin
            .from('projects')
            .update({ status: 'active' })
            .eq('company_profile_id', id);

        return NextResponse.json({
            success: true,
            message: 'Phase 1 approved. You can now generate ICP reports.',
        });

    } catch (error) {
        console.error('[API Approve] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
