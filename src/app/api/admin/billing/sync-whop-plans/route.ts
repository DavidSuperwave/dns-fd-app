import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { syncWhopPlansToDatabase, getWhopPlans } from '@/lib/whop-api';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Sync plans from Whop to our database
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
      console.warn(`[API Sync Whop Plans] Non-admin user attempt: ${user.email}`);
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Sync plans from Whop
    console.log('[Sync Whop Plans] Starting sync...');
    const result = await syncWhopPlansToDatabase();

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${result.synced_plans} plans from Whop`,
      synced_plans: result.synced_plans
    });

  } catch (error) {
    console.error('Error syncing Whop plans:', error);
    return NextResponse.json(
      { 
        error: 'Failed to sync Whop plans',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Get current Whop plans (without syncing to database)
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
      console.warn(`[API Get Whop Plans] Non-admin user attempt: ${user.email}`);
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get plans from Whop API
    const whopPlans = await getWhopPlans();

    // Also get synced plans from our database
    const supabaseAdmin = createAdminClient();
    const { data: dbPlans, error: dbError } = await supabaseAdmin
      .from('billing_plan_templates')
      .select('*')
      .not('whop_plan_id', 'is', null)
      .order('created_at', { ascending: false });

    if (dbError) {
      console.error('Error fetching database plans:', dbError);
    }

    return NextResponse.json({
      success: true,
      whop_plans: whopPlans,
      database_plans: dbPlans || [],
      sync_status: {
        whop_count: whopPlans.length,
        database_count: dbPlans?.length || 0,
        needs_sync: whopPlans.length !== (dbPlans?.length || 0)
      }
    });

  } catch (error) {
    console.error('Error fetching Whop plans:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch Whop plans',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
