import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase credentials in environment variables');
}

// Create Supabase client with service role for admin access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createScanResultsTable() {
  try {
    // Try to access the table first to see if it exists
    const { error: checkError } = await supabase
      .from('scan_results')
      .select('id')
      .limit(1);
    
    // If no 42P01 error, table exists
    if (!checkError || checkError.code !== '42P01') {
      console.log('scan_results table already exists');
      return { success: true, message: 'Table already exists' };
    }
    
    // Create the table using insert (this will create the table)
    const { error: createError } = await supabase
      .from('scan_results')
      .insert({
        id: '00000000-0000-0000-0000-000000000000', // Placeholder ID
        status: 'completed',
        total_domains: 0,
        domains_needing_attention: 0,
        completed_at: new Date().toISOString()
      })
      .select();
    
    if (createError && createError.code !== '23505') { // Ignore duplicate key errors
      throw new Error(`Error creating table: ${createError.message}`);
    }
    
    // Insert a dummy record to ensure the table is populated
    const { data, error } = await supabase
      .from('scan_results')
      .insert({
        status: 'completed',
        total_domains: 0,
        domains_needing_attention: 0,
        completed_at: new Date().toISOString()
      })
      .select();
    
    if (error) {
      throw new Error(`Error creating dummy record: ${error.message}`);
    }
    
    return { 
      success: true, 
      message: 'Table created successfully', 
      recordId: data?.[0]?.id
    };
  } catch (error: unknown) {
    console.error('Error in createScanResultsTable:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function POST() { // Remove unused 'request' parameter
  try {
    const result = await createScanResultsTable();
    
    return NextResponse.json(result, { 
      status: result.success ? 200 : 500
    });
  } catch (error: unknown) {
    console.error('Error setting up scan tables:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}