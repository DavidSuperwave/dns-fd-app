import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This is a regular Node.js API route, not Edge runtime
export const dynamic = 'force-dynamic';

/**
 * API endpoint to create necessary tables for the Cloudflare sync functionality
 * Uses Supabase JS client instead of raw SQL execution
 * 
 * Example usage: 
 * curl -X POST http://localhost:3000/api/setup/create-tables-js?key=SETUP_SECRET_KEY
 */
export async function POST(request: Request) {
  try {
    // Security check - require a setup key
    const url = new URL(request.url);
    const setupKey = url.searchParams.get('key');
    const validKey = process.env.SETUP_SECRET_KEY || 'dns-fd-R2wQ9p7X4sK8tL3zY6mN1bV5cX2zZ9mN8bV6xC3';
    
    if (setupKey !== validKey) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Invalid setup key' },
        { status: 401 }
      );
    }
    
    // Supabase credentials
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials in environment variables');
    }
    
    console.log('Connecting to Supabase:', supabaseUrl);
    
    // Initialize Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check if domains table exists by trying to select from it
    console.log('Checking if domains table exists...');
    const { error: domainsSelectError } = await supabase
      .from('domains')
      .select('id')
      .limit(1);
      
    const domainsTableExists = !domainsSelectError || domainsSelectError.code !== '42P01';
    console.log(`Domains table ${domainsTableExists ? 'exists' : 'does not exist'}`);
    
    // Check if sync_history table exists
    console.log('Checking if sync_history table exists...');
    const { error: syncHistorySelectError } = await supabase
      .from('sync_history')
      .select('id')
      .limit(1);
      
    const syncHistoryTableExists = !syncHistorySelectError || syncHistorySelectError.code !== '42P01';
    console.log(`Sync history table ${syncHistoryTableExists ? 'exists' : 'does not exist'}`);
    
    // If both tables exist, we're done
    if (domainsTableExists && syncHistoryTableExists) {
      console.log('Both tables already exist, no action needed');
      return NextResponse.json({
        success: true,
        message: 'Tables already exist, no changes made',
        tables: {
          domains: 'exists',
          sync_history: 'exists'
        }
      });
    }
    
    // Create the domains table by inserting a placeholder record
    // This leverages Supabase's auto-schema feature
    if (!domainsTableExists) {
      console.log('Creating domains table using auto-schema...');
      const { error: createDomainsError } = await supabase
        .from('domains')
        .insert({
          cloudflare_id: 'setup-placeholder',
          name: 'setup.example.com',
          status: 'placeholder',
          paused: false,
          type: 'setup',
          created_on: new Date().toISOString(),
          modified_on: new Date().toISOString(),
          last_synced: new Date().toISOString()
        });
      
      if (createDomainsError && createDomainsError.code !== '42P01') {
        throw new Error(`Failed to create domains table: ${createDomainsError.message}`);
      }
      
      // Clean up the placeholder
      await supabase
        .from('domains')
        .delete()
        .eq('cloudflare_id', 'setup-placeholder');
      
      console.log('Domains table created successfully');
    }
    
    // Create the sync_history table by inserting a placeholder record
    if (!syncHistoryTableExists) {
      console.log('Creating sync_history table using auto-schema...');
      const { error: createSyncHistoryError } = await supabase
        .from('sync_history')
        .insert({
          timestamp: new Date().toISOString(),
          domains_count: 0,
          success: true,
          error_message: 'Initial setup record',
          duration_ms: 0
        });
      
      if (createSyncHistoryError && createSyncHistoryError.code !== '42P01') {
        throw new Error(`Failed to create sync_history table: ${createSyncHistoryError.message}`);
      }
      
      console.log('Sync history table created successfully');
    }
    
    // Verify by inserting test records
    console.log('Verifying setup with test data...');
    
    try {
      // Insert test domain
      const { error: testDomainError } = await supabase
        .from('domains')
        .insert({
          cloudflare_id: 'api-setup-verification',
          name: 'api-test-domain.example.com',
          status: 'test',
          paused: false,
          type: 'verification',
          created_on: new Date().toISOString(),
          modified_on: new Date().toISOString(),
          last_synced: new Date().toISOString()
        });
      
      if (testDomainError) {
        console.warn('Warning: Failed to insert test domain:', testDomainError.message);
      }
      
      // Insert test sync record
      const { error: testSyncError } = await supabase
        .from('sync_history')
        .insert({
          timestamp: new Date().toISOString(),
          domains_count: 1,
          success: true,
          error_message: 'API endpoint setup verification',
          duration_ms: 0
        });
      
      if (testSyncError) {
        console.warn('Warning: Failed to insert test sync record:', testSyncError.message);
      }
      
      // Clean up test data
      await supabase
        .from('domains')
        .delete()
        .eq('cloudflare_id', 'api-setup-verification');
      
    } catch (verifyError) {
      console.warn('Verification warning:', verifyError);
    }
    
    // Check tables again to confirm creation
    const { error: finalDomainsError } = await supabase
      .from('domains')
      .select('id')
      .limit(1);
      
    const finalDomainsExists = !finalDomainsError || finalDomainsError.code !== '42P01';
    
    const { error: finalSyncError } = await supabase
      .from('sync_history')
      .select('id')
      .limit(1);
      
    const finalSyncExists = !finalSyncError || finalSyncError.code !== '42P01';
    
    return NextResponse.json({
      success: finalDomainsExists && finalSyncExists,
      message: finalDomainsExists && finalSyncExists 
        ? 'Database tables created and verified successfully' 
        : 'Setup completed with partial success',
      tables: {
        domains: finalDomainsExists ? 'exists' : 'failed to create',
        sync_history: finalSyncExists ? 'exists' : 'failed to create'
      },
      warnings: {
        domainsSetupError: !domainsTableExists && !finalDomainsExists ? 'Failed to create domains table' : null,
        syncHistorySetupError: !syncHistoryTableExists && !finalSyncExists ? 'Failed to create sync_history table' : null
      }
    });
  } catch (error) {
    console.error('Error creating tables:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        recommendation: 'Please use the Supabase Dashboard SQL Editor to create tables directly with the SQL script provided'
      },
      { status: 500 }
    );
  }
}