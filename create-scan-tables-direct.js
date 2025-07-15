#!/usr/bin/env node
/**
 * Direct PostgreSQL Table Creation Script
 * ---------------------------------------
 * This script creates tables needed for Cloudflare domain synchronization
 * by directly connecting to the PostgreSQL database using the provided credentials,
 * bypassing Supabase's client limitations.
 */

// Load environment variables
require('dotenv').config();
const { Client } = require('pg');

// Terminal colors for better readability
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Connection details from environment variables
const dbConfig = {
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DATABASE ,
  user: process.env.POSTGRES_USER ,
  password: process.env.POSTGRES_PASSWORD,
  port: 5432,
  ssl: {
    rejectUnauthorized: false // Required for Supabase connections
  }
};

// SQL statements for table creation
const createDomainsTableSQL = `
CREATE TABLE IF NOT EXISTS domains (
  id SERIAL PRIMARY KEY,
  cloudflare_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT,
  paused BOOLEAN DEFAULT FALSE,
  type TEXT,
  created_on TIMESTAMP WITH TIME ZONE,
  modified_on TIMESTAMP WITH TIME ZONE,
  last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID
);

-- Add index on cloudflare_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_domains_cloudflare_id ON domains(cloudflare_id);

-- Enable row level security
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;

-- Create policies (if they don't exist already)
DO $$ 
BEGIN
  -- Check if policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'domains' AND policyname = 'Enable read access for all users'
  ) THEN
    CREATE POLICY "Enable read access for all users" 
    ON domains FOR SELECT 
    USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'domains' AND policyname = 'Enable write access for service role'
  ) THEN
    CREATE POLICY "Enable write access for service role" 
    ON domains FOR ALL 
    USING (auth.role() = 'service_role');
  END IF;
END $$;
`;

const createSyncHistoryTableSQL = `
CREATE TABLE IF NOT EXISTS sync_history (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  domains_count INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  duration_ms INTEGER
);

-- Enable row level security
ALTER TABLE sync_history ENABLE ROW LEVEL SECURITY;

-- Create policies (if they don't exist already)
DO $$ 
BEGIN
  -- Check if policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sync_history' AND policyname = 'Enable read access for all users'
  ) THEN
    CREATE POLICY "Enable read access for all users" 
    ON sync_history FOR SELECT 
    USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sync_history' AND policyname = 'Enable insert for service role'
  ) THEN
    CREATE POLICY "Enable insert for service role" 
    ON sync_history FOR INSERT 
    WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
`;

// Function to verify tables exist
const verifyTablesSQL = `
SELECT 
  table_name,
  COUNT(column_name) AS column_count
FROM 
  information_schema.columns
WHERE 
  table_schema = 'public' 
  AND table_name IN ('domains', 'sync_history')
GROUP BY 
  table_name;
`;

// Function to insert test data
async function insertTestData(client) {
  console.log(`${colors.blue}Inserting test data to verify tables...${colors.reset}`);
  
  // Insert test domain
  try {
    await client.query(`
      INSERT INTO domains 
        (cloudflare_id, name, status, paused, type, created_on, modified_on, last_synced)
      VALUES 
        ('test-setup-verification', 'test-domain.example.com', 'test', false, 'verification', NOW(), NOW(), NOW())
      ON CONFLICT (cloudflare_id) DO NOTHING;
    `);
    console.log(`${colors.green}✓ Test domain inserted successfully${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}✗ Failed to insert test domain: ${error.message}${colors.reset}`);
    return false;
  }
  
  // Insert test sync history record
  try {
    await client.query(`
      INSERT INTO sync_history 
        (timestamp, domains_count, success, error_message, duration_ms)
      VALUES 
        (NOW(), 1, true, 'Test setup verification', 0);
    `);
    console.log(`${colors.green}✓ Test sync record inserted successfully${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}✗ Failed to insert test sync record: ${error.message}${colors.reset}`);
    return false;
  }
  
  // Clean up test domain (to prevent pollution)
  try {
    await client.query(`
      DELETE FROM domains WHERE cloudflare_id = 'test-setup-verification';
    `);
  } catch (error) {
    console.warn(`${colors.yellow}⚠ Warning: Failed to clean up test domain: ${error.message}${colors.reset}`);
  }
  
  return true;
}

// Main execution function
async function main() {
  console.log(`${colors.cyan}========================================${colors.reset}`);
  console.log(`${colors.cyan}   Direct PostgreSQL Table Setup Script ${colors.reset}`);
  console.log(`${colors.cyan}========================================${colors.reset}`);
  console.log(`${colors.blue}Connecting to: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}${colors.reset}`);
  
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    console.log(`${colors.green}✓ Connected to PostgreSQL database${colors.reset}`);
    
    // Create domains table
    console.log(`${colors.yellow}Creating domains table...${colors.reset}`);
    try {
      await client.query(createDomainsTableSQL);
      console.log(`${colors.green}✓ Domains table setup complete${colors.reset}`);
    } catch (error) {
      console.error(`${colors.red}✗ Failed to create domains table: ${error.message}${colors.reset}`);
      throw error;
    }
    
    // Create sync_history table
    console.log(`${colors.yellow}Creating sync_history table...${colors.reset}`);
    try {
      await client.query(createSyncHistoryTableSQL);
      console.log(`${colors.green}✓ Sync history table setup complete${colors.reset}`);
    } catch (error) {
      console.error(`${colors.red}✗ Failed to create sync_history table: ${error.message}${colors.reset}`);
      throw error;
    }
    
    // Verify tables were created
    console.log(`${colors.yellow}Verifying tables...${colors.reset}`);
    const { rows } = await client.query(verifyTablesSQL);
    
    if (rows.length === 2) {
      console.log(`${colors.green}✓ Both tables exist:${colors.reset}`);
      rows.forEach(row => {
        console.log(`  - ${row.table_name}: ${row.column_count} columns`);
      });
      
      // Test data insertion
      const testResult = await insertTestData(client);
      
      if (testResult) {
        console.log(`${colors.green}✓ Setup and verification completed successfully!${colors.reset}`);
      }
    } else {
      console.error(`${colors.red}✗ Verification failed: Expected 2 tables, found ${rows.length}${colors.reset}`);
      rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    }
  } catch (error) {
    console.error(`${colors.red}ERROR: ${error.message}${colors.reset}`);
    process.exit(1);
  } finally {
    await client.end();
    console.log(`${colors.blue}Connection closed${colors.reset}`);
  }
}

// Run the script
main().catch(error => {
  console.error(`${colors.red}Unexpected error: ${error.message}${colors.reset}`);
  process.exit(1);
});