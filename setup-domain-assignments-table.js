#!/usr/bin/env node
/**
 * Setup Domain Assignments Table
 * ----------------------------
 * This script creates the domain_assignments table in Supabase
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createDomainAssignmentsTable() {
  try {
    // Create domain_assignments table
    const { error } = await supabase.rpc('create_domain_assignments_table', {
      sql: `
        CREATE TABLE IF NOT EXISTS domain_assignments (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          domain_id UUID NOT NULL,
          user_email TEXT NOT NULL,
          assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_by TEXT,
          FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
        );
        
        -- Create index for faster lookups
        CREATE INDEX IF NOT EXISTS idx_domain_assignments_user_email 
        ON domain_assignments(user_email);
        
        -- Enable RLS
        ALTER TABLE domain_assignments ENABLE ROW LEVEL SECURITY;
        
        -- Policy for viewing assignments
        CREATE POLICY "Users can view their own assignments"
        ON domain_assignments
        FOR SELECT
        USING (auth.jwt() ->> 'email' = user_email OR auth.jwt() ->> 'email' = 'management@superwave.ai');
        
        -- Policy for creating assignments (admin only)
        CREATE POLICY "Only admin can create assignments"
        ON domain_assignments
        FOR INSERT
        WITH CHECK (auth.jwt() ->> 'email' = 'management@superwave.ai');
        
        -- Policy for deleting assignments (admin only)
        CREATE POLICY "Only admin can delete assignments"
        ON domain_assignments
        FOR DELETE
        USING (auth.jwt() ->> 'email' = 'management@superwave.ai');
      `
    });

    if (error) {
      throw error;
    }

    console.log('✓ domain_assignments table created successfully');
    return true;
  } catch (error) {
    console.error('Failed to create domain_assignments table:', error.message);
    return false;
  }
}

// Run the script
createDomainAssignmentsTable()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });