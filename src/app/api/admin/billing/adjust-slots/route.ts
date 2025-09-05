import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Admin endpoint to manually adjust user domain slots
export async function POST(request: NextRequest) {
  try {
    const {
      user_id,
      user_email, // For lookup if user_id not provided
      slots_adjustment, // +5, -2, etc.
      reason,
      is_free = true, // Whether this adjustment is free (admin grant) or paid
      admin_notes
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

    // Find target user by ID or email
    let targetUserId = user_id;
    if (!targetUserId && user_email) {
      const { data: targetUser } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('email', user_email)
        .single();
      
      if (!targetUser) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
      targetUserId = targetUser.id;
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'Either user_id or user_email is required' },
        { status: 400 }
      );
    }

    // Get or create user's billing plan
    let { data: billingPlan, error: planError } = await supabaseAdmin
      .from('billing_plans')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('status', 'active')
      .single();

    if (planError || !billingPlan) {
      // Create a new billing plan with manual management
      let manualTemplate = null;
      
      // Try to get Free Trial template, if not found, create a basic one
      const { data: existingTemplate } = await supabaseAdmin
        .from('billing_plan_templates')
        .select('*')
        .eq('name', 'Free Trial')
        .single();
      
      if (existingTemplate) {
        manualTemplate = existingTemplate;
      } else {
        // Create a basic template if none exists
        const { data: newTemplate } = await supabaseAdmin
          .from('billing_plan_templates')
          .insert({
            name: 'Free Trial',
            description: 'Default free trial plan',
            included_domain_slots: 3,
            base_price: 0,
            price_per_additional_slot: 0,
            max_domain_slots: 10,
            is_active: true,
            created_by: user.id
          })
          .select()
          .single();
        
        manualTemplate = newTemplate;
      }

      const { data: newPlan, error: createError } = await supabaseAdmin
        .from('billing_plans')
        .insert({
          user_id: targetUserId,
          plan_template_id: manualTemplate?.id,
          domain_slots_total: Math.max(manualTemplate?.included_domain_slots || 3, slots_adjustment),
          domain_slots_used: 0,
          effective_base_price: 0,
          effective_price_per_slot: 0,
          status: 'active',
          payment_provider: 'manual',
          admin_notes: `Initial slot allocation: ${slots_adjustment} slots. ${admin_notes || ''}`,
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

      billingPlan = newPlan;
    } else {
      // Update existing plan
      const newSlotTotal = Math.max(0, billingPlan.domain_slots_total + slots_adjustment);
      
      const { error: updateError } = await supabaseAdmin
        .from('billing_plans')
        .update({
          domain_slots_total: newSlotTotal,
          admin_notes: admin_notes ? `${billingPlan.admin_notes || ''}\n${new Date().toISOString()}: ${admin_notes}` : billingPlan.admin_notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', billingPlan.id);

      if (updateError) {
        console.error('Error updating billing plan:', updateError);
        return NextResponse.json(
          { error: 'Failed to update billing plan' },
          { status: 500 }
        );
      }

      // Update the local object for response
      billingPlan.domain_slots_total = newSlotTotal;
    }

    // Record the slot transaction
    const { error: transactionError } = await supabaseAdmin
      .from('domain_slot_transactions')
      .insert({
        billing_plan_id: billingPlan.id,
        transaction_type: is_free ? 'admin_adjustment' : 'purchase',
        slots_before: billingPlan.domain_slots_total - slots_adjustment,
        slots_after: billingPlan.domain_slots_total,
        slots_changed: slots_adjustment,
        amount: is_free ? 0 : null, // Can be set later for paid adjustments
        reason: reason || `Admin slot adjustment: ${slots_adjustment > 0 ? 'granted' : 'removed'} ${Math.abs(slots_adjustment)} slots`,
        created_by: user.id
      });

    if (transactionError) {
      console.error('Error recording slot transaction:', transactionError);
      // Don't fail the request for transaction logging errors
    }

    // Get updated billing plan info
    const { data: updatedPlan } = await supabaseAdmin
      .from('billing_plans')
      .select(`
        *,
        user_profiles (
          email,
          name
        )
      `)
      .eq('id', billingPlan.id)
      .single();

    return NextResponse.json({
      success: true,
      message: `${slots_adjustment > 0 ? 'Added' : 'Removed'} ${Math.abs(slots_adjustment)} domain slots`,
      billing_plan: updatedPlan,
      slots_before: billingPlan.domain_slots_total - slots_adjustment,
      slots_after: billingPlan.domain_slots_total,
      available_slots: billingPlan.domain_slots_total - billingPlan.domain_slots_used
    });

  } catch (error) {
    console.error('Error adjusting domain slots:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get user slot information for admin management
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('email');
    const userId = searchParams.get('user_id');

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

    // Build query based on parameters
    let query = supabaseAdmin
      .from('billing_plans')
      .select(`
        *,
        user_profiles (
          id,
          email,
          name,
          role
        ),
        billing_plan_templates (
          name,
          description
        )
      `);

    if (userId) {
      query = query.eq('user_id', userId);
    } else if (userEmail) {
      // Join with user_profiles to filter by email
      query = query.eq('user_profiles.email', userEmail);
    }

    const { data: billingPlans, error: plansError } = await query
      .eq('status', 'active')
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
      billing_plans: billingPlans || []
    });

  } catch (error) {
    console.error('Error fetching user slot info:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
