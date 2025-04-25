-- Create the scan_progress table to track active scan progress
CREATE TABLE IF NOT EXISTS scan_progress (
  id SERIAL PRIMARY KEY,
  scan_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,
  current_page INTEGER NOT NULL DEFAULT 1,
  total_pages INTEGER,
  domains_processed INTEGER NOT NULL DEFAULT 0,
  total_domains INTEGER,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT
);

-- Enable row level security
ALTER TABLE scan_progress ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" 
ON scan_progress FOR SELECT 
USING (true);

CREATE POLICY "Enable write access for service role" 
ON scan_progress FOR ALL 
USING (auth.role() = 'service_role');

-- Create index on is_active for efficient querying of active scans
CREATE INDEX IF NOT EXISTS idx_scan_progress_is_active ON scan_progress(is_active);

-- Insert a test record to verify setup
INSERT INTO scan_progress 
  (scan_id, status, current_page, total_pages, domains_processed, total_domains, is_active)
VALUES 
  ('test-setup', 'completed', 1, 1, 0, 0, false)
ON CONFLICT (scan_id) DO NOTHING;