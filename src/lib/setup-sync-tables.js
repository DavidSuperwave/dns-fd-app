#!/usr/bin/env node

/**
 * Supabase Table Setup Script for Cron Sync
 * 
 * This script creates the necessary tables for the Cloudflare to Supabase sync:
 * - domains: Stores Cloudflare domain information
 * - sync_history: Tracks sync operations and results
 * 
 * Run using:
 *   node src/lib/setup-sync-tables.js
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config(); // Initialize dotenv

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials. Please check your .env file.');
  process.exit(1);
}

// Set up colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Main execution function
 */
async function main() {
  console.log(`${colors.blue}=== Setting up Supabase tables for Cron Sync ===${colors.reset}`);
  console.log(`${colors.cyan}Connected to Supabase: ${supabaseUrl}${colors.reset}`);
  
  try {
    // Check if domains table exists
    console.log(`${colors.yellow}Checking if domains table exists...${colors.reset}`);
    const { error: domainsExistError } = await supabase
      .from('domains')
      .select('id')
      .limit(1);
    
    const domainsTableExists = !domainsExistError || domainsExistError.code !== '42P01';
    
    if (domainsTableExists) {
      console.log(`${colors.green}✓ domains table already exists${colors.reset}`);
    } else {
      console.log(`${colors.yellow}Creating domains table...${colors.reset}`);
      
      // Create domains table
      const { error: createDomainsError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE public.domains (
            id SERIAL PRIMARY KEY,
            cloudflare_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            status TEXT,
            paused BOOLEAN DEFAULT FALSE,
            type TEXT,
            created_on TIMESTAMP WITH TIME ZONE,
            modified_on TIMESTAMP WITH TIME ZONE,
            last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
          );
          
          -- Add index on cloudflare_id for faster lookups
          CREATE INDEX idx_domains_cloudflare_id ON public.domains(cloudflare_id);
          
          -- Enable row level security
          ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
          
          -- Create policies
          CREATE POLICY "Enable read access for all users" ON public.domains 
            FOR SELECT USING (true);
            
          CREATE POLICY "Enable write access for service role" ON public.domains 
            FOR ALL USING (auth.role() = 'service_role');
        `
      });
      
      if (createDomainsError) {
        throw new Error(`Failed to create domains table: ${createDomainsError.message}`);
      }
      
      console.log(`${colors.green}✓ domains table created successfully${colors.reset}`);
    }
    
    // Check if sync_history table exists
    console.log(`${colors.yellow}Checking if sync_history table exists...${colors.reset}`);
    const { error: syncExistError } = await supabase
      .from('sync_history')
      .select('id')
      .limit(1);
    
    const syncTableExists = !syncExistError || syncExistError.code !== '42P01';
    
    if (syncTableExists) {
      console.log(`${colors.green}✓ sync_history table already exists${colors.reset}`);
    } else {
      console.log(`${colors.yellow}Creating sync_history table...${colors.reset}`);
      
      // Create sync_history table
      const { error: createSyncError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE public.sync_history (
            id SERIAL PRIMARY KEY,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            domains_count INTEGER DEFAULT 0,
            success BOOLEAN DEFAULT TRUE,
            error_message TEXT,
            duration_ms INTEGER
          );
          
          -- Enable row level security
          ALTER TABLE public.sync_history ENABLE ROW LEVEL SECURITY;
          
          -- Create policies
          CREATE POLICY "Enable read access for all users" ON public.sync_history 
            FOR SELECT USING (true);
            
          CREATE POLICY "Enable insert for service role" ON public.sync_history 
            FOR ALL USING (auth.role() = 'service_role');
        `
      });
      
      if (createSyncError) {
        throw new Error(`Failed to create sync_history table: ${createSyncError.message}`);
      }
      
      console.log(`${colors.green}✓ sync_history table created successfully${colors.reset}`);
    }
    
    // Setup complete!
    console.log(`${colors.green}=== Setup complete! ===${colors.reset}`);
    console.log(`${colors.cyan}Tables ready for Cloudflare to Supabase synchronization${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}ERROR: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run the script
main();