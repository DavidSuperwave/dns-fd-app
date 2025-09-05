import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Use a domain slot when assigning/creating a domain
export async function POST(request: NextRequest) {
  try {
    const { domain_id, domain_name, action = 'assign' } = await request.json();

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

    // Get user's active billing plan
    const { data: billingPlan, error: planError } = await supabaseAdmin
      .from('billing_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (planError || !billingPlan) {
      return NextResponse.json(
        { error: 'No active billing plan found' },
        { status: 400 }
      );
    }

    // Check if user has available slots
    if (billingPlan.domain_slots_available <= 0) {
      return NextResponse.json(
        { 
          error: 'No available domain slots',
          available_slots: 0,
          total_slots: billingPlan.domain_slots_total,
          upgrade_needed: true
        },
        { status: 403 }
      );
    }

    // Use a slot (increment used count)
    const newUsedSlots = billingPlan.domain_slots_used + 1;
    
    // Update billing plan
    const { error: updateError } = await supabaseAdmin
      .from('billing_plans')
      .update({
        domain_slots_used: newUsedSlots,
        updated_at: new Date().toISOString()
      })
      .eq('id', billingPlan.id);

    if (updateError) {
      console.error('Error updating domain slots:', updateError);
      return NextResponse.json(
        { error: 'Failed to update domain slots' },
        { status: 500 }
      );
    }

    // Record the transaction
    const { error: transactionError } = await supabaseAdmin
      .from('domain_slot_transactions')
      .insert({
        billing_plan_id: billingPlan.id,
        transaction_type: 'usage',
        slots_before: billingPlan.domain_slots_used,
        slots_after: newUsedSlots,
        slots_changed: 1,
        reason: `Domain ${action}: ${domain_name}`,
        domain_id: domain_id,
        created_by: user.id
      });

    if (transactionError) {
      console.error('Error recording slot transaction:', transactionError);
      // Don't fail the request for transaction logging errors
    }

    return NextResponse.json({
      success: true,
      available_slots: billingPlan.domain_slots_total - newUsedSlots,
      total_slots: billingPlan.domain_slots_total,
      used_slots: newUsedSlots,
      transaction_id: 'recorded'
    });

  } catch (error) {
    console.error('Error using domain slot:', error);
    return NextResponse.json(
      { error: 'Failed to use domain slot' },
      { status: 500 }
    );
  }
}

// Release a domain slot when removing/unassigning a domain
export async function DELETE(request: NextRequest) {
  try {
    const { domain_id, domain_name, action = 'remove' } = await request.json();

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

    // Get user's active billing plan
    const { data: billingPlan, error: planError } = await supabaseAdmin
      .from('billing_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (planError || !billingPlan) {
      return NextResponse.json(
        { error: 'No active billing plan found' },
        { status: 400 }
      );
    }

    // Release a slot (decrement used count)
    const newUsedSlots = Math.max(0, billingPlan.domain_slots_used - 1);
    
    // Update billing plan
    const { error: updateError } = await supabaseAdmin
      .from('billing_plans')
      .update({
        domain_slots_used: newUsedSlots,
        updated_at: new Date().toISOString()
      })
      .eq('id', billingPlan.id);

    if (updateError) {
      console.error('Error updating domain slots:', updateError);
      return NextResponse.json(
        { error: 'Failed to update domain slots' },
        { status: 500 }
      );
    }

    // Record the transaction
    const { error: transactionError } = await supabaseAdmin
      .from('domain_slot_transactions')
      .insert({
        billing_plan_id: billingPlan.id,
        transaction_type: 'release',
        slots_before: billingPlan.domain_slots_used,
        slots_after: newUsedSlots,
        slots_changed: -1,
        reason: `Domain ${action}: ${domain_name}`,
        domain_id: domain_id,
        created_by: user.id
      });

    if (transactionError) {
      console.error('Error recording slot transaction:', transactionError);
    }

    return NextResponse.json({
      success: true,
      available_slots: billingPlan.domain_slots_total - newUsedSlots,
      total_slots: billingPlan.domain_slots_total,
      used_slots: newUsedSlots
    });

  } catch (error) {
    console.error('Error releasing domain slot:', error);
    return NextResponse.json(
      { error: 'Failed to release domain slot' },
      { status: 500 }
    );
  }
}
