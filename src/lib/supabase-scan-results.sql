-- Scan Results Table for Cloudflare Domain Monitoring
-- This table stores the results of domain scans

-- Create extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create scan_results table
CREATE TABLE IF NOT EXISTS scan_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL,
  progress_current INTEGER DEFAULT 0,
  progress_total INTEGER DEFAULT 0,
  progress_percentage INTEGER DEFAULT 0,
  total_domains INTEGER DEFAULT 0,
  domains_needing_attention INTEGER DEFAULT 0,
  scan_duration_ms INTEGER,
  failed_reason TEXT,
  scan_result JSONB,
  status_breakdown JSONB
);

-- Create index on status for quick filtering
CREATE INDEX IF NOT EXISTS idx_scan_results_status ON scan_results(status);

-- Create index on completed_at for quick sorting
CREATE INDEX IF NOT EXISTS idx_scan_results_completed_at ON scan_results(completed_at DESC);

-- Row-level security policy
ALTER TABLE scan_results ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all scan results
CREATE POLICY "Authenticated users can read scan results"
  ON scan_results FOR SELECT
  TO authenticated
  USING (true);

-- Only allow service role or admin to insert/update scan results
CREATE POLICY "Only service role can insert scan results"
  ON scan_results FOR INSERT
  TO service_role
  USING (true);

CREATE POLICY "Only service role can update scan results"
  ON scan_results FOR UPDATE
  TO service_role
  USING (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_scan_results_updated_at ON scan_results;
CREATE TRIGGER update_scan_results_updated_at
BEFORE UPDATE ON scan_results
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add explicit permissions
GRANT SELECT ON scan_results TO anon, authenticated;
GRANT ALL ON scan_results TO service_role;