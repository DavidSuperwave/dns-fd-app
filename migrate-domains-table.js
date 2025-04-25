#!/usr/bin/env node
/**
 * Migration script to add redirect_url column to domains table
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: Missing Supabase credentials in .env file');
  console.log('Please ensure you have the following environment variables set:');
  console.log('- NEXT_PUBLIC_SUPABASE_URL');
  console.log('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Initialize Supabase client with service role key for admin access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('Running migration to add redirect_url column...');

    // Read the SQL file
    const sqlPath = path.join(__dirname, 'add-redirect-column.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      throw error;
    }

    console.log('✓ Migration completed successfully');
    
    // Verify the column exists
    const { data, error: verifyError } = await supabase
      .from('domains')
      .select('redirect_url')
      .limit(1);

    if (verifyError) {
      throw new Error(`Failed to verify column: ${verifyError.message}`);
    }

    console.log('✓ Column verified - redirect_url is now available');
    return true;
  } catch (error) {
    console.error('Migration failed:', error.message);
    return false;
  }
}

// Run the migration
runMigration().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});