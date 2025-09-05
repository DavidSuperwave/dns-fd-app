import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Assign pricing plan to user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { plan_template_id } = await request.json();

    if (!plan_template_id) {
      return NextResponse.json(
        { error: 'plan_template_id is required' },
        { status: 400 }
      );
    }

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

    // Check admin permissions
    const isAdmin = user.email === 'admin@superwave.io' || user.user_metadata?.role === 'admin';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabaseAdmin = createAdminClient();

    // Verify the plan template exists
    const { data: planTemplate, error: templateError } = await supabaseAdmin
      .from('billing_plan_templates')
      .select('*')
      .eq('id', plan_template_id)
      .single();

    if (templateError || !planTemplate) {
      return NextResponse.json(
        { error: 'Plan template not found' },
        { status: 400 }
      );
    }

    // Check if user already has a billing plan
    const { data: existingPlan, error: planError } = await supabaseAdmin
      .from('billing_plans')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existingPlan) {
      // Update existing plan
      const { error: updateError } = await supabaseAdmin
        .from('billing_plans')
        .update({
          plan_template_id: plan_template_id,
          effective_base_price: planTemplate.base_price,
          effective_price_per_slot: planTemplate.price_per_additional_slot,
          effective_domain_limit: planTemplate.max_domain_slots,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPlan.id);

      if (updateError) {
        console.error('Error updating billing plan:', updateError);
        return NextResponse.json(
          { error: 'Failed to update billing plan' },
          { status: 500 }
        );
      }

      // Record pricing history
      await supabaseAdmin
        .from('pricing_history')
        .insert({
          billing_plan_id: existingPlan.id,
          change_type: 'plan_assignment',
          new_plan_template_id: plan_template_id,
          old_plan_template_id: existingPlan.plan_template_id,
          reason: 'Admin plan assignment',
          changed_by: user.id
        });

    } else {
      // Create new billing plan
      const { error: createError } = await supabaseAdmin
        .from('billing_plans')
        .insert({
          user_id: userId,
          plan_template_id: plan_template_id,
          domain_slots_total: planTemplate.included_domain_slots,
          domain_slots_used: 0,
          effective_base_price: planTemplate.base_price,
          effective_price_per_slot: planTemplate.price_per_additional_slot,
          effective_domain_limit: planTemplate.max_domain_slots,
          status: 'active',
          payment_provider: 'whop',
          created_by: user.id
        });

      if (createError) {
        console.error('Error creating billing plan:', createError);
        return NextResponse.json(
          { error: 'Failed to create billing plan' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${planTemplate.name} plan to user`,
      plan_name: planTemplate.name,
      base_price: planTemplate.base_price
    });

  } catch (error) {
    console.error('Error assigning plan:', error);
    return NextResponse.json(
      { error: 'Failed to assign plan' },
      { status: 500 }
    );
  }
}
