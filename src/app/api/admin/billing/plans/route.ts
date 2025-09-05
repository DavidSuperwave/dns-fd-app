import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Get all billing plans (Admin only)
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

    // Get all billing plans with user and template info
    const { data: billingPlans, error: plansError } = await supabaseAdmin
      .from('billing_plans')
      .select(`
        *,
        user_profiles (
          email,
          name
        ),
        billing_plan_templates (
          name,
          description,
          included_domain_slots,
          base_price,
          price_per_additional_slot
        )
      `)
      .order('created_at', { ascending: false });

    if (plansError) {
      console.error('Error fetching billing plans:', plansError);
      return NextResponse.json(
        { error: 'Failed to fetch billing plans' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      billing_plans: billingPlans
    });

  } catch (error) {
    console.error('Error in admin billing plans:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Create or update a billing plan (Admin only)
export async function POST(request: NextRequest) {
  try {
    const {
      user_id,
      plan_template_id,
      custom_base_price,
      custom_price_per_slot,
      custom_domain_limit,
      domain_slots_total,
      admin_notes,
      payment_provider = 'manual'
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

    // Get the plan template details
    const { data: template, error: templateError } = await supabaseAdmin
      .from('billing_plan_templates')
      .select('*')
      .eq('id', plan_template_id)
      .single();

    if (templateError || !template) {
      return NextResponse.json(
        { error: 'Invalid plan template' },
        { status: 400 }
      );
    }

    // Calculate effective values
    const effective_base_price = custom_base_price ?? template.base_price;
    const effective_price_per_slot = custom_price_per_slot ?? template.price_per_additional_slot;
    const effective_domain_limit = custom_domain_limit ?? template.max_domain_slots;

    // Check if user already has an active billing plan
    const { data: existingPlan } = await supabaseAdmin
      .from('billing_plans')
      .select('*')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .single();

    if (existingPlan) {
      // Update existing plan
      const { data: updatedPlan, error: updateError } = await supabaseAdmin
        .from('billing_plans')
        .update({
          plan_template_id,
          custom_base_price,
          custom_price_per_slot,
          custom_domain_limit,
          domain_slots_total: domain_slots_total ?? template.included_domain_slots,
          effective_base_price,
          effective_price_per_slot,
          effective_domain_limit,
          admin_notes,
          payment_provider,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPlan.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating billing plan:', updateError);
        return NextResponse.json(
          { error: 'Failed to update billing plan' },
          { status: 500 }
        );
      }

      // Record the change in pricing history
      await supabaseAdmin
        .from('pricing_history')
        .insert({
          billing_plan_id: existingPlan.id,
          change_type: 'admin_adjustment',
          old_base_price: existingPlan.effective_base_price,
          new_base_price: effective_base_price,
          old_price_per_slot: existingPlan.effective_price_per_slot,
          new_price_per_slot: effective_price_per_slot,
          old_domain_slots: existingPlan.domain_slots_total,
          new_domain_slots: domain_slots_total ?? template.included_domain_slots,
          old_plan_template_id: existingPlan.plan_template_id,
          new_plan_template_id: plan_template_id,
          reason: 'Admin plan adjustment',
          changed_by: user.id
        });

      return NextResponse.json({
        success: true,
        billing_plan: updatedPlan,
        action: 'updated'
      });

    } else {
      // Create new plan
      const { data: newPlan, error: createError } = await supabaseAdmin
        .from('billing_plans')
        .insert({
          user_id,
          plan_template_id,
          custom_base_price,
          custom_price_per_slot,
          custom_domain_limit,
          domain_slots_total: domain_slots_total ?? template.included_domain_slots,
          domain_slots_used: 0,
          effective_base_price,
          effective_price_per_slot,
          effective_domain_limit,
          admin_notes,
          payment_provider,
          status: 'active',
          created_by: user.id
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating billing plan:', createError);
        return NextResponse.json(
          { error: 'Failed to create billing plan' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        billing_plan: newPlan,
        action: 'created'
      });
    }

  } catch (error) {
    console.error('Error creating/updating billing plan:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
