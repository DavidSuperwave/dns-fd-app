-- Simple SQL Script for creating the necessary tables
-- This can be executed directly in the Supabase SQL Editor

-- Create the domains table
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

-- Create the sync_history table
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

-- Create policies for domains table
CREATE POLICY "Enable read access for all users" 
ON domains FOR SELECT 
USING (true);

CREATE POLICY "Enable write access for service role" 
ON domains FOR ALL 
USING (auth.role() = 'service_role');

-- Create policies for sync_history table
CREATE POLICY "Enable read access for all users" 
ON sync_history FOR SELECT 
USING (true);

CREATE POLICY "Enable insert for service role" 
ON sync_history FOR INSERT 
WITH CHECK (auth.role() = 'service_role');

-- Insert a test record to verify the setup
INSERT INTO domains 
  (cloudflare_id, name, status, paused, type, created_on, modified_on, last_synced)
VALUES 
  ('test-setup-verification', 'test-domain.example.com', 'test', false, 'verification', NOW(), NOW(), NOW())
ON CONFLICT (cloudflare_id) DO NOTHING;

INSERT INTO sync_history 
  (timestamp, domains_count, success, error_message, duration_ms)
VALUES 
  (NOW(), 1, true, 'Test setup verification', 0);

-- Clean up test data
DELETE FROM domains WHERE cloudflare_id = 'test-setup-verification';