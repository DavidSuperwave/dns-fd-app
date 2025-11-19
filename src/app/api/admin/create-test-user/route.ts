import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../../lib/supabase-admin';

export async function POST(request: Request) {
    try {
        const supabaseAdmin = createAdminClient();
        const { email, password, role } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
        }

        console.log(`Creating test user: ${email}`);

        // Create the auth user
        const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Skip email confirmation
            user_metadata: {
                name: email.split('@')[0],
                role: role || 'user'
            }
        });

        if (createError) {
            return NextResponse.json({ error: createError.message }, { status: 400 });
        }

        const userId = userData.user.id;

        // Create user profile
        const { error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .insert({
                id: userId,
                email: email,
                name: email.split('@')[0],
                role: role || 'user',
                status: 'active',
                active: true
            });

        if (profileError) {
            console.error('Profile creation error:', profileError);
            // Don't fail - user can still login
        }

        // Assign default billing plan
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
        } catch (error) {
            console.error('Billing plan error:', error);
        }

        return NextResponse.json({
            success: true,
            message: 'Test user created successfully',
            email,
            userId
        });

    } catch (error) {
        console.error('Error creating test user:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to create user'
        }, { status: 500 });
    }
}
