import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase credentials in environment variables');
}

// Create Supabase client with service role for admin access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * WARNING: This endpoint executes raw SQL. It should be used very carefully
 * and only in controlled environments with proper authentication.
 */
export async function POST(request: NextRequest) {
  try {
    // Get the SQL from the request body
    const { sql, allowTableCreation = false, apiKey } = await request.json();
    
    // Basic security check - require an API key that matches an environment variable
    // This is a very simple security measure and should be improved in production
    const REQUIRED_API_KEY = process.env.SETUP_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20);
    
    if (!REQUIRED_API_KEY || apiKey !== REQUIRED_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized: Invalid API key'
      }, { status: 401 });
    }
    
    // Check for table creation commands if not allowed
    if (!allowTableCreation) {
      const sqlLower = sql.toLowerCase();
      if (
        sqlLower.includes('create table') ||
        sqlLower.includes('drop table') ||
        sqlLower.includes('alter table')
      ) {
        return NextResponse.json({
          success: false,
          error: 'Table creation/modification not allowed unless explicitly permitted'
        }, { status: 403 });
      }
    }
    
    // Execute the SQL using supabase functions or stored procedures
    const response = await executeSql(sql);
    
    return NextResponse.json(response, { 
      status: response.success ? 200 : 500
    });
  } catch (error: unknown) {
    console.error('Error executing SQL:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Execute SQL using different methods until one works
 */
async function executeSql(sql: string) {
  // Try methods in order of preference
  
  try {
    // 1. Try to use direct query method (requires minimal permissions)
    const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });
    
    if (!error) {
      return { success: true, data, message: 'SQL executed successfully via execute_sql RPC' };
    }
    
    // 2. Try pgcode method (requires more permissions)
    const { data: pgcodeData, error: pgcodeError } = await supabase.rpc('pgcode', { code: sql });
    
    if (!pgcodeError) {
      return { success: true, data: pgcodeData, message: 'SQL executed successfully via pgcode RPC' };
    }
    
    // 3. Direct method for creating scan_results table
    if (sql.toLowerCase().includes('create table') && sql.toLowerCase().includes('scan_results')) {
      const createTableResult = await createScanResultsTableDirect();
      if (createTableResult.success) {
        return createTableResult;
      }
    }
    
    return { 
      success: false, 
      error: 'All SQL execution methods failed', 
      details: {
        execute_sql_error: error,
        pgcode_error: pgcodeError
      }
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during SQL execution'
    };
  }
}

/**
 * Create scan_results table directly using insert operation
 */
async function createScanResultsTableDirect() {
  try {
    // Try to access the table first to see if it exists
    const { error: checkError } = await supabase
      .from('scan_results')
      .select('id')
      .limit(1);
    
    // If no 42P01 error, table exists
    if (!checkError || checkError.code !== '42P01') {
      return { success: true, message: 'scan_results table already exists' };
    }
    
    // Try to create the table using an insert operation
    // This is a hack that works because Supabase will create the table with the correct schema
    // if it receives an insert with the right structure
    const { error: createError } = await supabase
      .from('scan_results')
      .insert({
        status: 'completed',
        total_domains: 0,
        domains_needing_attention: 0,
        completed_at: new Date().toISOString()
      })
      .select();
    
    if (!createError || createError.code === '23505') { // Ignore duplicate key errors
      return { success: true, message: 'scan_results table created successfully' };
    }
    
    return { 
      success: false, 
      error: 'Failed to create table directly', 
      details: createError
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating table directly'
    };
  }
}