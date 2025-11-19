import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function GET(request: NextRequest) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    cookieStore.set({ name, value, ...options });
                },
                remove(name: string, options: CookieOptions) {
                    cookieStore.set({ name, value: '', ...options });
                },
            },
        }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Query inboxing_domains for this user's email to get usage and limits
    const { data: domains, error: dbError } = await supabase
        .from('inboxing_domains')
        .select('id, tenant_domain_limit')
        .eq('admin_email', user.email)
        .eq('is_active', true);

    if (dbError) {
        console.error('Error fetching domains for slots:', dbError);
        return NextResponse.json({ error: 'Failed to fetch domain slots' }, { status: 500 });
    }

    const usedSlots = domains?.length || 0;
    // Try to find a limit from any domain record. Default to 0 if no domains found.
    const totalSlots = domains?.[0]?.tenant_domain_limit || 0;
    const availableSlots = Math.max(0, totalSlots - usedSlots);

    return NextResponse.json({
        status: 'success',
        data: {
            total_slots: totalSlots,
            used_slots: usedSlots,
            pending_slots: 0,
            committed_slots: usedSlots,
            available_slots: availableSlots,
            user_id: user.id,
            username: user.email,
        }
    });
}
