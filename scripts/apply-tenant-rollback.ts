#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.log('Please ensure you have set these in your .env.local file or environment');
  process.exit(1);
}

// Initialize the Supabase client with service_role key for migrations
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  try {
    console.log('Starting tenant schema rollback...');
    
    // Load the SQL file
    const sqlFilePath = path.join(__dirname, '..', 'db', 'migrations', 'rollback_tenant_company_changes.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Execute the SQL against Supabase
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });
    
    if (error) {
      console.error('Error executing SQL:', error);
      process.exit(1);
    }
    
    console.log('Tenant schema rollback completed successfully!');
    console.log('This should fix the domain assignments loading error.');
    
  } catch (error) {
    console.error('Unexpected error during migration:', error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
