import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Check user's available domain slots
export async function GET(request: NextRequest) {
  try {
    // Get user from session
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

    // Get user's billing plan
    const supabaseAdmin = createAdminClient();
    const { data: billingPlan, error: planError } = await supabaseAdmin
      .from('billing_plans')
      .select(`
        *,
        billing_plan_templates (
          name,
          included_domain_slots,
          max_domain_slots
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (planError || !billingPlan) {
      // No active billing plan - create default free trial
      const { data: defaultTemplate } = await supabaseAdmin
        .from('billing_plan_templates')
        .select('*')
        .eq('name', 'Free Trial')
        .single();

      if (defaultTemplate) {
        const { data: newPlan, error: createError } = await supabaseAdmin
          .from('billing_plans')
          .insert({
            user_id: user.id,
            plan_template_id: defaultTemplate.id,
            domain_slots_total: defaultTemplate.included_domain_slots,
            domain_slots_used: 0,
            effective_base_price: defaultTemplate.base_price,
            effective_price_per_slot: defaultTemplate.price_per_additional_slot,
            effective_domain_limit: defaultTemplate.max_domain_slots,
            status: 'trial',
            payment_provider: 'manual'
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating default billing plan:', createError);
          return NextResponse.json({
            available_slots: 0,
            total_slots: 0,
            used_slots: 0,
            plan_name: 'No Plan',
            status: 'inactive'
          });
        }

        return NextResponse.json({
          available_slots: newPlan.domain_slots_available,
          total_slots: newPlan.domain_slots_total,
          used_slots: newPlan.domain_slots_used,
          plan_name: 'Free Trial',
          status: newPlan.status,
          billing_plan_id: newPlan.id
        });
      }
      // Default template not found - return empty/inactive state
      console.warn('Default "Free Trial" billing plan template not found');
      return NextResponse.json({
        available_slots: 0,
        total_slots: 0,
        used_slots: 0,
        plan_name: 'No Plan',
        status: 'inactive'
      });
    }

    if (!billingPlan) {
      // Should be unreachable if logic above is correct, but for safety
      return NextResponse.json({
        available_slots: 0,
        total_slots: 0,
        used_slots: 0,
        plan_name: 'No Plan',
        status: 'inactive'
      });
    }

    // Return current slot information
    return NextResponse.json({
      available_slots: billingPlan.domain_slots_available,
      total_slots: billingPlan.domain_slots_total,
      used_slots: billingPlan.domain_slots_used,
      plan_name: billingPlan.billing_plan_templates?.name || 'Unknown',
      status: billingPlan.status,
      billing_plan_id: billingPlan.id,
      next_billing_amount: billingPlan.next_billing_amount,
      current_period_end: billingPlan.current_period_end
    });

  } catch (error) {
    console.error('Error checking domain slots:', error);
    return NextResponse.json(
      { error: 'Failed to check domain slots' },
      { status: 500 }
    );
  }
}
