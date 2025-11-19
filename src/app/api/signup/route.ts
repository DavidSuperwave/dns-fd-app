// src/app/api/signup/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    console.error('[API Signup] Supabase admin client is not initialized.');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  let token: string | null = null;
  let email: string | null = null;
  let password: string | null = null;

  try {
    const body = await request.json();
    token = body.token;
    email = body.email;
    password = body.password;

    if (!token || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`[API Signup] Setting up password for: ${email}`);

    // Step 1: Verify invitation
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('token', token)
      .eq('email', email)
      .is('used_at', null)
      .maybeSingle();

    if (inviteError || !invitation) {
      console.error('[API Signup] Invalid invitation');
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 400 });
    }

    // Step 2: Find the existing user (created by inviteUserByEmail)
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error('[API Signup] Error listing users:', listError);
      return NextResponse.json({ error: 'Failed to verify user' }, { status: 500 });
    }

    const existingUser = users.find(u => u.email === email);

    if (!existingUser) {
      return NextResponse.json({ error: 'User account not found' }, { status: 404 });
    }

    const userId = existingUser.id;

    // Step 3: Update password for the invited user
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        password: password,
        user_metadata: {
          name: email.split('@')[0],
          role: invitation.role
        },
        email_confirm: true
      }
    );

    if (updateError) {
      console.error('[API Signup] Failed to update password:', updateError);
      return NextResponse.json({ error: 'Failed to set password' }, { status: 500 });
    }

    try {
      // Step 4: Mark invitation as used
      await supabaseAdmin
        .from('invitations')
        .update({ used_at: new Date().toISOString() })
        .eq('token', token);

      // Step 5: Create user profile
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: userId,
          email: email,
          name: email.split('@')[0],
          role: invitation.role,
          status: 'active',
          active: true
        });

      if (profileError) {
        console.error('[API Signup] Profile creation failed:', profileError);
        throw profileError;
      }

      // Step 6: Assign default billing plan
      try {
        const { data: planTemplate } = await supabaseAdmin
          .from('billing_plan_templates')
          .select('*')
          .eq('whop_plan_id', 'plan_KmHruy3fDVOtP')
          .single();

        if (planTemplate) {
          await supabaseAdmin
            .from('billing_plans')
            .insert({
              user_id: userId,
              plan_template_id: planTemplate.id,
              domain_slots_total: planTemplate.included_domain_slots || 1,
              domain_slots_used: 0,
              effective_base_price: planTemplate.base_price,
              effective_price_per_slot: planTemplate.price_per_additional_slot,
              effective_domain_limit: planTemplate.max_domain_slots,
              status: 'active',
              payment_provider: 'whop'
            });
        }
      } catch (planError) {
        console.error('[API Signup] Error creating billing plan:', planError);
      }

      return NextResponse.json({
        success: true,
        message: 'Account created successfully'
      }, { status: 201 });

    } catch (postError) {
      console.error('[API Signup] Post-creation error:', postError);
      return NextResponse.json({
        error: 'Account setup failed'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[ API Signup] Error:', error);
    return NextResponse.json({
      error: 'An unexpected error occurred'
    }, { status: 500 });
  }
}