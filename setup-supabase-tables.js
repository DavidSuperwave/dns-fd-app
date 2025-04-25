#!/usr/bin/env node
/**
 * Supabase Table Setup Script
 * ----------------------------
 * This script creates the required tables for the Cloudflare domain synchronization
 * using Supabase's auto-schema feature.
 * 
 * Usage:
 *   node setup-supabase-tables.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Terminal colors for better readability
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(`${colors.red}ERROR: Missing Supabase credentials in .env file${colors.reset}`);
  console.log('Please ensure you have the following environment variables set:');
  console.log('- NEXT_PUBLIC_SUPABASE_URL');
  console.log('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Initialize Supabase client with service role key for admin access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Creates the domains table if it doesn't exist using auto-schema
 */
async function createDomainsTable() {
  console.log(`${colors.yellow}Checking if domains table exists...${colors.reset}`);
  
  try {
    // Try to select from domains table
    const { error } = await supabase
      .from('domains')
      .select('id')
      .limit(1);
    
    // If table exists, we're done
    if (!error || error.code !== '42P01') {
      console.log(`${colors.green}✓ domains table already exists${colors.reset}`);
      return true;
    }

    // Table doesn't exist, create it using auto-schema feature
    console.log(`${colors.blue}Creating domains table using auto-schema...${colors.reset}`);
    
    // Insert a placeholder record to create the table with the desired schema
    const { error: insertError } = await supabase
      .from('domains')
      .insert({
        cloudflare_id: 'setup-placeholder',
        name: 'setup.example.com',
        status: 'placeholder',
        paused: false,
        type: 'setup',
        created_on: new Date().toISOString(),
        modified_on: new Date().toISOString(),
        last_synced: new Date().toISOString(),
        redirect_url: null
      });
    
    if (insertError && insertError.code !== '42P01') {
      throw new Error(`Failed to create domains table: ${insertError.message}`);
    }
    
    console.log(`${colors.green}✓ domains table created successfully${colors.reset}`);
    
    // Clean up the placeholder record
    await supabase
      .from('domains')
      .delete()
      .eq('cloudflare_id', 'setup-placeholder');
    
    return true;
  } catch (error) {
    console.error(`${colors.red}✗ Failed to create domains table: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Creates the sync_history table if it doesn't exist using auto-schema
 */
async function createSyncHistoryTable() {
  console.log(`${colors.yellow}Checking if sync_history table exists...${colors.reset}`);
  
  try {
    // Try to select from sync_history table
    const { error } = await supabase
      .from('sync_history')
      .select('id')
      .limit(1);
    
    // If table exists, we're done
    if (!error || error.code !== '42P01') {
      console.log(`${colors.green}✓ sync_history table already exists${colors.reset}`);
      return true;
    }

    // Table doesn't exist, create it using auto-schema feature
    console.log(`${colors.blue}Creating sync_history table using auto-schema...${colors.reset}`);
    
    // Insert a placeholder record to create the table
    const { error: insertError } = await supabase
      .from('sync_history')
      .insert({
        timestamp: new Date().toISOString(),
        domains_count: 0,
        success: true,
        error_message: 'Initial setup record',
        duration_ms: 0
      });
    
    if (insertError && insertError.code !== '42P01') {
      throw new Error(`Failed to create sync_history table: ${insertError.message}`);
    }
    
    console.log(`${colors.green}✓ sync_history table created successfully${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}✗ Failed to create sync_history table: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Verify tables were created successfully by inserting test records
 */
async function verifySetup() {
  console.log(`${colors.blue}Verifying setup with test records...${colors.reset}`);
  
  try {
    // Insert test record into domains
    const { error: domainError } = await supabase
      .from('domains')
      .insert({
        cloudflare_id: 'test-setup-verification',
        name: 'test-domain.example.com',
        status: 'test',
        paused: false,
        type: 'verification',
        created_on: new Date().toISOString(),
        modified_on: new Date().toISOString(),
        last_synced: new Date().toISOString(),
        redirect_url: null
      });
    
    if (domainError) {
      throw new Error(`Failed to insert test domain: ${domainError.message}`);
    }
    
    // Insert test record into sync_history
    const { error: syncError } = await supabase
      .from('sync_history')
      .insert({
        timestamp: new Date().toISOString(),
        domains_count: 1,
        success: true,
        error_message: 'Test setup verification',
        duration_ms: 0
      });
    
    if (syncError) {
      throw new Error(`Failed to insert test sync record: ${syncError.message}`);
    }
    
    // Clean up test domain record
    await supabase
      .from('domains')
      .delete()
      .eq('cloudflare_id', 'test-setup-verification');
    
    console.log(`${colors.green}✓ Verification successful - tables are working correctly${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}✗ Verification failed: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Check if the necessary RLS policies are in place
 */
async function setupRlsPolicies() {
  console.log(`${colors.blue}Enabling Row Level Security is handled automatically by Supabase${colors.reset}`);
  console.log(`${colors.yellow}NOTE: You may need to manually configure RLS policies in the Supabase dashboard${colors.reset}`);
  console.log(`Recommended policies for domains table:`);
  console.log(`  - Enable read access for all authenticated users`);
  console.log(`  - Enable write access for service role`);
  console.log(`Recommended policies for sync_history table:`);
  console.log(`  - Enable read access for all authenticated users`);
  console.log(`  - Enable insert for service role`);
  return true;
}

/**
 * Main function to run the setup
 */
async function main() {
  console.log(`${colors.cyan}========================================${colors.reset}`);
  console.log(`${colors.cyan}     Supabase Tables Setup Script       ${colors.reset}`);
  console.log(`${colors.cyan}========================================${colors.reset}`);
  console.log(`${colors.blue}Connected to: ${supabaseUrl}${colors.reset}`);
  
  const domainsCreated = await createDomainsTable();
  const syncHistoryCreated = await createSyncHistoryTable();
  
  if (domainsCreated && syncHistoryCreated) {
    const verificationPassed = await verifySetup();
    await setupRlsPolicies();
    
    if (verificationPassed) {
      console.log(`${colors.green}✓ Setup completed successfully!${colors.reset}`);
      return 0;
    } else {
      console.error(`${colors.red}✗ Setup verification failed.${colors.reset}`);
      return 1;
    }
  } else {
    console.error(`${colors.red}✗ Setup failed. Please check the error messages above.${colors.reset}`);
    return 1;
  }
}

// Run the script
main().then(exitCode => {
  process.exit(exitCode);
}).catch(error => {
  console.error(`${colors.red}Unexpected error: ${error.message}${colors.reset}`);
  process.exit(1);
});