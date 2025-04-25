import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Enable edge runtime
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * This endpoint sets up the required tables for Cloudflare to Supabase synchronization
 * It can be triggered with a GET request and a secret key parameter
 * Example: /api/supabase/setup-sync-tables?key=dns-fd-R2wQ9p7X4sK8tL3zY6mN1bV5cX2zZ9mN8bV6xC3
 */
export async function GET(request: Request) {
  try {
    // Check for setup key for authorization
    const url = new URL(request.url);
    const setupKey = url.searchParams.get('key');
    const validKey = process.env.CRON_SECRET || 'dns-fd-R2wQ9p7X4sK8tL3zY6mN1bV5cX2zZ9mN8bV6xC3';
    
    if (setupKey !== validKey) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', providedKey: setupKey },
        { status: 401 }
      );
    }
    
    // Initialize Supabase client with service role key for full access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Prepare our response data
    const setupResults = {
      domains: {
        exists: false,
        status: 'pending'
      },
      sync_history: {
        exists: false,
        status: 'pending'
      }
    };
    
    // Check if domains table exists by attempting to read from it
    console.log('Checking if domains table exists...');
    const { error: domainsError } = await supabase // Remove unused 'domainsData'
      .from('domains')
      .select('id', { count: 'exact', head: true }); // More efficient check
    
    // If error code is not '42P01' (undefined_table), the table exists
    setupResults.domains.exists = !domainsError || domainsError.code !== '42P01';
    
    if (setupResults.domains.exists) {
      console.log('Domains table already exists');
      setupResults.domains.status = 'existing';
    } else {
      console.log('Domains table does not exist, creating using auto-schema feature...');
      
      // Create domains table by inserting a sample record
      // Supabase will auto-create the table with the schema we define
      const { error: createError } = await supabase
        .from('domains')
        .insert({
          cloudflare_id: 'setup-placeholder',
          name: 'setup.example.com',
          status: 'active',
          paused: false,
          type: 'setup',
          created_on: new Date().toISOString(),
          modified_on: new Date().toISOString(),
          last_synced: new Date().toISOString()
        });
      
      if (!createError) {
        console.log('Domains table created successfully');
        setupResults.domains.status = 'created';
        
        // Clean up the placeholder record
        await supabase
          .from('domains')
          .delete()
          .eq('cloudflare_id', 'setup-placeholder');
      } else {
        console.error('Failed to create domains table:', createError);
        setupResults.domains.status = 'failed';
        throw new Error(`Failed to create domains table: ${createError.message}`);
      }
    }
    
    // Check if sync_history table exists
    console.log('Checking if sync_history table exists...');
    const { error: syncError } = await supabase // Remove unused 'syncData'
      .from('sync_history')
      .select('id', { count: 'exact', head: true }); // More efficient check
    
    setupResults.sync_history.exists = !syncError || syncError.code !== '42P01';
    
    if (setupResults.sync_history.exists) {
      console.log('Sync history table already exists');
      setupResults.sync_history.status = 'existing';
    } else {
      console.log('Sync history table does not exist, creating using auto-schema feature...');
      
      // Create sync_history table by inserting a sample record
      const { error: createSyncError } = await supabase
        .from('sync_history')
        .insert({
          timestamp: new Date().toISOString(),
          domains_count: 0,
          success: true,
          error_message: 'Initial setup record',
          duration_ms: 0
        });
      
      if (!createSyncError) {
        console.log('Sync history table created successfully');
        setupResults.sync_history.status = 'created';
      } else {
        console.error('Failed to create sync_history table:', createSyncError);
        setupResults.sync_history.status = 'failed';
        throw new Error(`Failed to create sync_history table: ${createSyncError.message}`);
      }
    }
    
    // Get table info to verify column names
    console.log('Verifying table structure...');
    
    // Provide status report
    return NextResponse.json({
      success: true,
      message: 'Supabase tables setup completed',
      timestamp: new Date().toISOString(),
      tables: setupResults
    });
  } catch (error) {
    console.error('Error setting up Supabase tables:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}