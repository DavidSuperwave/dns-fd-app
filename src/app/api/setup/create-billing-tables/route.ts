import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

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
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabaseAdmin = createAdminClient();

    // Check if billing tables exist
    const { data: existingTables } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['billing_plan_templates', 'billing_plans', 'domain_slot_transactions', 'billing_history']);

    const tableNames = existingTables?.map(t => t.table_name) || [];
    
    if (tableNames.length === 4) {
      return NextResponse.json({
        success: true,
        message: 'Billing tables already exist',
        tables: tableNames
      });
    }

    return NextResponse.json({
      success: false,
      message: 'Please run the create-billing-system-schema.sql script in Supabase SQL Editor',
      missing_tables: ['billing_plan_templates', 'billing_plans', 'domain_slot_transactions', 'billing_history'].filter(t => !tableNames.includes(t)),
      existing_tables: tableNames
    });

  } catch (error) {
    console.error('Error checking billing tables:', error);
    return NextResponse.json(
      { error: 'Failed to check billing tables' },
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
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabaseAdmin = createAdminClient();

    // Check billing tables status
    const checks = await Promise.allSettled([
      supabaseAdmin.from('billing_plan_templates').select('count').limit(1),
      supabaseAdmin.from('billing_plans').select('count').limit(1),
      supabaseAdmin.from('domain_slot_transactions').select('count').limit(1),
      supabaseAdmin.from('billing_history').select('count').limit(1),
    ]);

    const tableStatus = {
      billing_plan_templates: checks[0].status === 'fulfilled',
      billing_plans: checks[1].status === 'fulfilled',
      domain_slot_transactions: checks[2].status === 'fulfilled',
      billing_history: checks[3].status === 'fulfilled',
    };

    const allTablesExist = Object.values(tableStatus).every(exists => exists);

    // If tables exist, get plan templates count
    let planTemplatesCount = 0;
    if (tableStatus.billing_plan_templates) {
      const { count } = await supabaseAdmin
        .from('billing_plan_templates')
        .select('*', { count: 'exact', head: true });
      planTemplatesCount = count || 0;
    }

    return NextResponse.json({
      success: allTablesExist,
      table_status: tableStatus,
      plan_templates_count: planTemplatesCount,
      ready_for_use: allTablesExist && planTemplatesCount > 0
    });

  } catch (error) {
    console.error('Error checking billing system status:', error);
    return NextResponse.json(
      { error: 'Failed to check billing system status' },
      { status: 500 }
    );
  }
}
