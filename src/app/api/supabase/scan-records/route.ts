import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-client';

export async function POST() { // Remove unused 'request' parameter
  try {
    // Create initial record
    const { data, error } = await supabaseAdmin
      .from('scan_results')
      .insert({
        status: 'running',
        total_domains: 0,
        domains_needing_attention: 0,
        scan_result: {
          success: false,
          timestamp: new Date().toISOString(),
          totalDomains: 0,
          nonActiveDomains: 0
        },
        status_breakdown: {},
        non_active_domains: []
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating scan record:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error('Error in scan records route:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { id, progress, ...updateData } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Record ID is required' },
        { status: 400 }
      );
    }

    // Store progress info in scan_result
    if (progress) {
      updateData.scan_result = {
        ...updateData.scan_result,
        progress
      };
    }

    const { error } = await supabaseAdmin
      .from('scan_results')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Error updating scan record:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in scan records route:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('scan_results')
      .select('*')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return NextResponse.json({ success: true, data: null });
      }
      console.error('Error fetching latest scan:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in scan records route:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}