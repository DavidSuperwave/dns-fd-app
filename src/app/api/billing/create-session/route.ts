import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Create Whop checkout session with user metadata
export async function POST(request: NextRequest) {
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

    const supabaseAdmin = createAdminClient();

    // Get user's billing plan to find their assigned plan template
    const { data: billingPlan, error: planError } = await supabaseAdmin
      .from('billing_plans')
      .select(`
        *,
        billing_plan_templates (
          name,
          whop_plan_id,
          base_price
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (planError || !billingPlan || !billingPlan.billing_plan_templates?.whop_plan_id) {
      return NextResponse.json(
        { error: 'No active billing plan with Whop integration found' },
        { status: 400 }
      );
    }

    // Get user profile for email
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('email, name')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 400 }
      );
    }

    // Create Whop checkout session
    const whopResponse = await fetch('https://api.whop.com/v2/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHOP_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan_id: billingPlan.billing_plan_templates.whop_plan_id,
        metadata: {
          user_id: user.id,
          user_email: userProfile.email,
          billing_plan_id: billingPlan.id,
          domain_slot_purchase: 'true'
        },
        prefill: {
          email: userProfile.email,
          name: userProfile.name || userProfile.email
        }
      })
    });

    if (!whopResponse.ok) {
      const errorData = await whopResponse.text();
      console.error('Whop API Error:', errorData);
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 }
      );
    }

    const sessionData = await whopResponse.json();

    return NextResponse.json({
      success: true,
      session_id: sessionData.id,
      checkout_url: sessionData.checkout_url,
      plan_id: billingPlan.billing_plan_templates.whop_plan_id,
      price: billingPlan.billing_plan_templates.base_price,
      plan_name: billingPlan.billing_plan_templates.name
    });

  } catch (error) {
    console.error('Error creating Whop session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
