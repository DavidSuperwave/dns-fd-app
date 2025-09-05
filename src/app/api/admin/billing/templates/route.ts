import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Get all billing plan templates (Admin only)
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          async get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if user is admin
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabaseAdmin = createAdminClient();

    // Get all plan templates
    const { data: templates, error: templatesError } = await supabaseAdmin
      .from('billing_plan_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (templatesError) {
      console.error('Error fetching plan templates:', templatesError);
      return NextResponse.json(
        { error: 'Failed to fetch plan templates' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      templates: templates
    });

  } catch (error) {
    console.error('Error in admin plan templates:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Create a new billing plan template (Admin only)
export async function POST(request: NextRequest) {
  try {
    const {
      name,
      description,
      included_domain_slots,
      base_price,
      price_per_additional_slot,
      max_domain_slots,
      billing_cycle = 'monthly',
      is_custom = false,
      whop_plan_id,
      stripe_price_id
    } = await request.json();

    // Verify admin access
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          async get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if user is admin
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabaseAdmin = createAdminClient();

    // Validate required fields
    if (!name || base_price === undefined || included_domain_slots === undefined) {
      return NextResponse.json(
        { error: 'Name, base_price, and included_domain_slots are required' },
        { status: 400 }
      );
    }

    // Create the template
    const { data: template, error: createError } = await supabaseAdmin
      .from('billing_plan_templates')
      .insert({
        name,
        description,
        included_domain_slots,
        base_price,
        price_per_additional_slot: price_per_additional_slot || 0,
        max_domain_slots,
        billing_cycle,
        is_custom,
        whop_plan_id,
        stripe_price_id,
        is_active: true,
        created_by: user.id
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating plan template:', createError);
      return NextResponse.json(
        { error: 'Failed to create plan template' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      template: template
    });

  } catch (error) {
    console.error('Error creating plan template:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Update a billing plan template (Admin only)
export async function PUT(request: NextRequest) {
  try {
    const {
      id,
      name,
      description,
      included_domain_slots,
      base_price,
      price_per_additional_slot,
      max_domain_slots,
      billing_cycle,
      is_custom,
      is_active,
      whop_plan_id,
      stripe_price_id
    } = await request.json();

    // Verify admin access
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          async get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if user is admin
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabaseAdmin = createAdminClient();

    // Update the template
    const { data: template, error: updateError } = await supabaseAdmin
      .from('billing_plan_templates')
      .update({
        name,
        description,
        included_domain_slots,
        base_price,
        price_per_additional_slot,
        max_domain_slots,
        billing_cycle,
        is_custom,
        is_active,
        whop_plan_id,
        stripe_price_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating plan template:', updateError);
      return NextResponse.json(
        { error: 'Failed to update plan template' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      template: template
    });

  } catch (error) {
    console.error('Error updating plan template:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
