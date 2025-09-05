import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Add domain slot after successful Whop payment
export async function POST(request: NextRequest) {
  try {
    const { receipt_id, session_id } = await request.json();

    if (!receipt_id || !session_id) {
      return NextResponse.json(
        { error: 'Missing receipt_id or session_id' },
        { status: 400 }
      );
    }

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

    // Verify the checkout session with Whop to get metadata
    const whopResponse = await fetch(`https://api.whop.com/v2/checkout/sessions/${session_id}`, {
      headers: {
        'Authorization': `Bearer ${process.env.WHOP_API_KEY}`,
      }
    });

    if (!whopResponse.ok) {
      console.error('Failed to verify Whop session');
      return NextResponse.json(
        { error: 'Failed to verify payment' },
        { status: 400 }
      );
    }

    const sessionData = await whopResponse.json();

    // Verify the session belongs to this user
    if (sessionData.metadata?.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Payment verification failed' },
        { status: 403 }
      );
    }

    // Get user's billing plan
    const { data: billingPlan, error: planError } = await supabaseAdmin
      .from('billing_plans')
      .select('*')
      .eq('id', sessionData.metadata.billing_plan_id)
      .eq('user_id', user.id)
      .single();

    if (planError || !billingPlan) {
      return NextResponse.json(
        { error: 'Billing plan not found' },
        { status: 400 }
      );
    }

    // Add 1 domain slot
    const newTotalSlots = billingPlan.domain_slots_total + 1;

    // Update billing plan
    const { error: updateError } = await supabaseAdmin
      .from('billing_plans')
      .update({
        domain_slots_total: newTotalSlots,
        updated_at: new Date().toISOString()
      })
      .eq('id', billingPlan.id);

    if (updateError) {
      console.error('Error updating domain slots:', updateError);
      return NextResponse.json(
        { error: 'Failed to add domain slot' },
        { status: 500 }
      );
    }

    // Record the transaction
    const { error: transactionError } = await supabaseAdmin
      .from('domain_slot_transactions')
      .insert({
        billing_plan_id: billingPlan.id,
        transaction_type: 'purchase',
        slots_before: billingPlan.domain_slots_total,
        slots_after: newTotalSlots,
        slots_changed: 1,
        reason: 'Domain slot purchase via Whop',
        external_transaction_id: receipt_id,
        payment_provider: 'whop',
        created_by: user.id
      });

    if (transactionError) {
      console.error('Error recording slot transaction:', transactionError);
      // Don't fail the request for transaction logging errors
    }

    // Record billing history
    const { error: historyError } = await supabaseAdmin
      .from('billing_history')
      .insert({
        billing_plan_id: billingPlan.id,
        amount: sessionData.amount_total / 100, // Convert from cents
        currency: sessionData.currency || 'usd',
        payment_status: 'completed',
        payment_provider: 'whop',
        external_transaction_id: receipt_id,
        external_receipt_url: sessionData.receipt_url,
        description: 'Domain slot purchase',
        provider_response: sessionData
      });

    if (historyError) {
      console.error('Error recording billing history:', historyError);
    }

    return NextResponse.json({
      success: true,
      slots_added: 1,
      new_total_slots: newTotalSlots,
      available_slots: newTotalSlots - billingPlan.domain_slots_used,
      receipt_id: receipt_id
    });

  } catch (error) {
    console.error('Error adding domain slot:', error);
    return NextResponse.json(
      { error: 'Failed to add domain slot' },
      { status: 500 }
    );
  }
}
