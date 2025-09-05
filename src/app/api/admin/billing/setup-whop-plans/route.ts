import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Predefined Whop plans - per-domain pricing tiers
const WHOP_PLANS = [
  {
    name: 'Premium Domain Slot',
    description: '$50 per domain slot - Premium tier',
    included_domain_slots: 1,
    base_price: 50.00,
    price_per_additional_slot: 50.00,
    max_domain_slots: null,
    whop_plan_id: 'plan_KmHruy3fDVOtP'
  },
  {
    name: 'Professional Domain Slot',
    description: '$40 per domain slot - Professional tier',
    included_domain_slots: 1,
    base_price: 40.00,
    price_per_additional_slot: 40.00,
    max_domain_slots: null,
    whop_plan_id: 'plan_6U0rRsvDL9VvM'
  },
  {
    name: 'Business Domain Slot',
    description: '$30 per domain slot - Business tier',
    included_domain_slots: 1,
    base_price: 30.00,
    price_per_additional_slot: 30.00,
    max_domain_slots: null,
    whop_plan_id: 'plan_4uR7cOFf9Ruxl'
  },
  {
    name: 'Growth Domain Slot',
    description: '$25 per domain slot - Growth tier',
    included_domain_slots: 1,
    base_price: 25.00,
    price_per_additional_slot: 25.00,
    max_domain_slots: null,
    whop_plan_id: 'plan_QRc2RVkLKgK5l'
  },
  {
    name: 'Starter Domain Slot',
    description: '$20 per domain slot - Starter tier',
    included_domain_slots: 1,
    base_price: 20.00,
    price_per_additional_slot: 20.00,
    max_domain_slots: null,
    whop_plan_id: 'plan_xj1hzkSUCPewx'
  },
  {
    name: 'Basic Domain Slot',
    description: '$15 per domain slot - Basic tier',
    included_domain_slots: 1,
    base_price: 15.00,
    price_per_additional_slot: 15.00,
    max_domain_slots: null,
    whop_plan_id: 'plan_ktRtPxomsvkPt'
  }
];

export async function POST(request: NextRequest) {
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
    const isAdmin = user.email === 'admin@superwave.io' || user.user_metadata?.role === 'admin';
    
    if (!isAdmin) {
      console.warn(`[API Setup Whop Plans] Non-admin user attempt: ${user.email}`);
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabaseAdmin = createAdminClient();

    console.log('[Setup Whop Plans] Starting setup of predefined plans...');
    
    // Insert/update all plans
    const insertedPlans = [];
    for (const plan of WHOP_PLANS) {
      try {
        const { data, error } = await supabaseAdmin
          .from('billing_plan_templates')
          .upsert({
            ...plan,
            billing_cycle: 'monthly',
            is_custom: false,
            is_active: true,
            created_by: user.id,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'whop_plan_id'
          })
          .select()
          .single();

        if (error) {
          console.error(`Error upserting plan ${plan.name}:`, error);
        } else {
          insertedPlans.push(data);
          console.log(`✅ Upserted plan: ${plan.name} (${plan.included_domain_slots} slots)`);
        }
      } catch (error) {
        console.error(`Error processing plan ${plan.name}:`, error);
      }
    }

    // Get final count of plans
    const { data: allPlans, error: countError } = await supabaseAdmin
      .from('billing_plan_templates')
      .select('name, included_domain_slots, base_price, whop_plan_id')
      .not('whop_plan_id', 'is', null)
      .order('included_domain_slots', { ascending: false });

    if (countError) {
      console.error('Error fetching plan count:', countError);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully set up ${insertedPlans.length} Whop plans`,
      plans_created: insertedPlans.length,
      total_whop_plans: allPlans?.length || 0,
      plans: allPlans || []
    });

  } catch (error) {
    console.error('Error setting up Whop plans:', error);
    return NextResponse.json(
      { 
        error: 'Failed to set up Whop plans',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

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
    const isAdmin = user.email === 'admin@superwave.io' || user.user_metadata?.role === 'admin';
    
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabaseAdmin = createAdminClient();

    // Get current plans in database
    const { data: dbPlans, error: dbError } = await supabaseAdmin
      .from('billing_plan_templates')
      .select('*')
      .not('whop_plan_id', 'is', null)
      .order('included_domain_slots', { ascending: false });

    if (dbError) {
      console.error('Error fetching database plans:', dbError);
      return NextResponse.json(
        { error: 'Failed to fetch database plans' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      predefined_plans: WHOP_PLANS,
      database_plans: dbPlans || [],
      setup_needed: (dbPlans?.length || 0) === 0
    });

  } catch (error) {
    console.error('Error fetching Whop plans setup:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
