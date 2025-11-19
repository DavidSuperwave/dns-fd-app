import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// GET - Fetch assignments for a domain
export async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const { searchParams } = new URL(request.url);
    const domainId = searchParams.get('domain_id');

    if (!domainId) {
        return NextResponse.json({ error: 'domain_id is required' }, { status: 400 });
    }

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

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const isAdmin = user.email === 'admin@superwave.io' || user.user_metadata?.role === 'admin';

    if (!isAdmin) {
        console.log(`[Domain Assignments API] Access denied for user: ${user.email}`);
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { data: assignments, error } = await supabase
        .from('domain_assignments')
        .select('*')
        .eq('domain_id', parseInt(domainId));

    if (error) {
        console.error('Error fetching assignments:', error);
        return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
    }

    return NextResponse.json({ assignments });
}

// POST - Create a new assignment
export async function POST(request: NextRequest) {
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

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const isAdmin = user.email === 'admin@superwave.io' || user.user_metadata?.role === 'admin';

    if (!isAdmin) {
        console.log(`[Domain Assignments API] POST access denied for user: ${user.email}`);
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { domain_id, user_email } = body;

    if (!domain_id || !user_email) {
        return NextResponse.json({ error: 'domain_id and user_email are required' }, { status: 400 });
    }

    // Check if assignment already exists
    const { data: existing } = await supabase
        .from('domain_assignments')
        .select('id')
        .eq('domain_id', domain_id)
        .eq('user_email', user_email)
        .single();

    if (existing) {
        return NextResponse.json({ error: 'Assignment already exists' }, { status: 409 });
    }

    const { data, error } = await supabase
        .from('domain_assignments')
        .insert({
            domain_id: parseInt(domain_id),
            user_email,
            created_by: user.email,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating assignment:', error);
        return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 });
    }

    return NextResponse.json({ assignment: data });
}

// DELETE - Remove an assignment
export async function DELETE(request: NextRequest) {
    const cookieStore = await cookies();
    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('id');

    if (!assignmentId) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

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

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const isAdmin = user.email === 'admin@superwave.io' || user.user_metadata?.role === 'admin';

    if (!isAdmin) {
        console.log(`[Domain Assignments API] DELETE access denied for user: ${user.email}`);
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { error } = await supabase
        .from('domain_assignments')
        .delete()
        .eq('id', assignmentId);

    if (error) {
        console.error('Error deleting assignment:', error);
        return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
