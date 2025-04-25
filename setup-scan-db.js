/**
 * Direct database setup script for scan tables
 * This script directly executes SQL queries to set up scan tables
 * @ts-nocheck
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Get Supabase credentials from environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in environment variables');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase client with service role for full database access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function setupScanTables() {
  console.log('🔍 Setting up scan tables directly with SQL...');
  
  try {
    // Read the SQL file content
    const sqlPath = path.join(__dirname, 'src', 'lib', 'create-scan-results.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL directly
    const { error } = await supabase.rpc('exec_sql', { sql: sqlContent });
    
    if (error) {
      console.error('❌ Failed to execute SQL:', error);
      
      // Try alternative approach - split and run individual statements
      console.log('🔄 Trying alternative approach with individual statements...');
      const statements = sqlContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
      
      let successCount = 0;
      for (const statement of statements) {
        try {
          const { error: stmtError } = await supabase.rpc('exec_sql', { 
            sql: statement + ';' 
          });
          
          if (stmtError) {
            console.error(`❌ Error executing statement: ${statement}`);
            console.error(stmtError);
          } else {
            successCount++;
          }
        } catch (err) {
          console.error(`❌ Exception executing statement: ${statement}`);
          console.error(err);
        }
      }
      
      console.log(`✅ Executed ${successCount}/${statements.length} SQL statements successfully`);
    } else {
      console.log('✅ SQL script executed successfully');
    }
    
    // Verify table exists by attempting to query it
    const { data, error: queryError } = await supabase
      .from('scan_results')
      .select('id')
      .limit(1);
    
    if (queryError) {
      console.error('❌ Table verification failed:', queryError);
      process.exit(1);
    } else {
      console.log('✅ Table scan_results verified to exist');
      console.log(`Found ${data.length} existing records`);
    }
    
  } catch (error) {
    console.error('❌ Error setting up scan tables:', error);
    process.exit(1);
  }
}

// Handle direct fallback for table creation
async function createFallbackRecord() {
  console.log('🔄 Creating fallback record to prevent errors...');
  
  try {
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
      console.error('❌ Failed to create fallback record:', error);
    } else {
      console.log('✅ Created fallback record successfully:', data[0].id);
    }
  } catch (error) {
    console.error('❌ Exception creating fallback record:', error);
  }
}

// Execute the setup function
(async () => {
  await setupScanTables();
  await createFallbackRecord();
  console.log('✅ Setup complete');
})();