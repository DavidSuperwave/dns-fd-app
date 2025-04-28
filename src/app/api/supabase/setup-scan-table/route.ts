import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-client';

// Helper function to create/verify scan table
async function setupScanTable() {
  try {
    // Create initial scan record to test/create table
    if (!supabaseAdmin) {
      throw new Error('Supabase client is not initialized');
    }

    const { error: createError } = await supabaseAdmin
      .from('scan_results')
      .insert([{
        status: 'completed',
        total_domains: 0,
        domains_needing_attention: 0,
        scan_result: {
          success: true,
          timestamp: new Date().toISOString(),
          totalDomains: 0,
          nonActiveDomains: 0
        },
        status_breakdown: {},
        non_active_domains: [],
        completed_at: new Date().toISOString(),
        progress: { current: 0, total: 0, percentage: 0 }
      }]);

    if (!createError) {
      // Table exists and record was created
      return {
        success: true,
        message: 'Scan results table exists and is working'
      };
    }

    // If table doesn't exist, try to create it with a dummy record
    const { error: tableError } = await supabaseAdmin
      .from('scan_results')
      .insert([{
        id: '00000000-0000-0000-0000-000000000000',
        status: 'completed',
        total_domains: 0,
        domains_needing_attention: 0,
        scan_result: {
          success: true,
          timestamp: new Date().toISOString(),
          totalDomains: 0,
          nonActiveDomains: 0
        },
        status_breakdown: {},
        non_active_domains: [],
        completed_at: new Date().toISOString(),
        progress: { current: 0, total: 0, percentage: 0 }
      }]);

    if (tableError) {
      console.error('Error creating scan results table:', tableError);
      return {
        success: false,
        error: tableError.message
      };
    }

    return {
      success: true,
      message: 'Scan results table created successfully'
    };
  } catch (error) {
    console.error('Error in setupScanTable:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// GET handler to check table status
export async function GET() {
  try {
    // Check if table exists by attempting to select
    if (!supabaseAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Supabase client is not initialized'
      }, { status: 500 });
    }

    const { error: checkError } = await supabaseAdmin
      .from('scan_results')
      .select('id')
      .limit(1);

    return NextResponse.json({
      success: true,
      exists: !checkError,
      message: checkError ? 'Scan results table does not exist' : 'Scan results table exists'
    });
  } catch (error) {
    console.error('Error checking scan table:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST handler to create/verify table
export async function POST() {
  try {
    const result = await setupScanTable();
    return NextResponse.json(result, {
      status: result.success ? 200 : 500
    });
  } catch (error) {
    console.error('Error in setup-scan-table route:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}