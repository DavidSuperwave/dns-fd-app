import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-client';

export async function POST(request: NextRequest) {
  try {
    const supabaseAdminClient = supabaseAdmin;

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Admin client not available. Check SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 500 }
      );
    }

    const { email = 'admin@superwave.io', password = 'hmn7pkq.XBH9yrq_vbk' } = await request.json().catch(() => ({}));

    // Step 1: Create the auth user with email confirmed
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: email.split('@')[0],
        role: 'admin'
      },
      app_metadata: {
        provider: 'email'
      }
    });

    if (createError) {
      // Check if user already exists
      if (createError.message.toLowerCase().includes('already registered') ||
        createError.message.toLowerCase().includes('already exists')) {
        // Try to get the existing user
        const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
        const user = existingUser?.users?.find(u => u.email === email);

        if (user) {
          // User exists, check if profile exists
          const { data: existingProfile } = await supabaseAdmin
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (!existingProfile) {
            // Create profile for existing user
            await supabaseAdmin
              .from('user_profiles')
              .insert({
                id: user.id,
                email: user.email || email,
                name: user.user_metadata?.name || email.split('@')[0],
                role: 'admin',
                active: true,
                status: 'active',
                created_at: new Date().toISOString()
              });
          }

          return NextResponse.json({
            success: true,
            message: 'Admin account already exists',
            user_id: user.id
          });
        }
      }

      return NextResponse.json(
        { error: `Failed to create user: ${createError.message}` },
        { status: 500 }
      );
    }

    if (!createData?.user) {
      return NextResponse.json(
        { error: 'Failed to create user account (no user data returned).' },
        { status: 500 }
      );
    }

    const userId = createData.user.id;
    console.log(`[Setup API] Auth user created successfully for ${email}, ID: ${userId}`);

    // Step 2: Create user profile
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: userId,
        email: email,
        name: email.split('@')[0],
        role: 'admin',
        active: true,
        status: 'active',
        created_at: new Date().toISOString()
      });

    if (profileError) {
      // If profile creation fails, try to update instead (in case it exists)
      const { error: updateError } = await supabaseAdmin
        .from('user_profiles')
        .upsert({
          id: userId,
          email: email,
          name: email.split('@')[0],
          role: 'admin',
          active: true,
          status: 'active',
          created_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (updateError) {
        console.error('[Setup API] Failed to create/update user profile:', updateError);
        // Don't fail the request - user is created, profile can be fixed later
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Admin account created successfully',
      user_id: userId,
      email: email
    });

  } catch (error) {
    console.error('[Setup API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

