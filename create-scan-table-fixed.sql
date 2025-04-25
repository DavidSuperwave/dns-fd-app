-- Drop existing table if needed
DROP TABLE IF EXISTS public.scan_results;

-- Create the scan_results table with correct schema
CREATE TABLE public.scan_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  total_domains INTEGER DEFAULT 0,
  domains_needing_attention INTEGER DEFAULT 0,
  scan_duration_ms INTEGER,
  progress_current INTEGER DEFAULT 0,
  progress_total INTEGER DEFAULT 0,
  progress_percentage INTEGER DEFAULT 0,
  scan_result JSONB,
  status_breakdown JSONB,
  non_active_domains JSONB,
  failed_reason TEXT
);

-- Enable RLS
ALTER TABLE public.scan_results ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated users to view scan results" ON public.scan_results;
DROP POLICY IF EXISTS "Allow authenticated users to create scan results" ON public.scan_results;
DROP POLICY IF EXISTS "Allow authenticated users to update scan results" ON public.scan_results;

-- Create policies with proper authentication checks
CREATE POLICY "Allow authenticated users to view scan results" 
  ON public.scan_results
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to create scan results" 
  ON public.scan_results
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update scan results" 
  ON public.scan_results
  FOR UPDATE
  TO authenticated
  USING (true);

-- Insert test data
INSERT INTO public.scan_results (
  status,
  total_domains,
  domains_needing_attention,
  scan_duration_ms,
  completed_at,
  progress_current,
  progress_total,
  progress_percentage,
  status_breakdown,
  non_active_domains,
  scan_result
) VALUES (
  'completed',
  5031,
  3,
  1500,
  NOW(),
  10,
  10,
  100,
  '{"active": 5028, "pending": 2, "moved": 1}'::jsonb,
  '[
    {"id": "test1", "name": "example1.com", "status": "pending"},
    {"id": "test2", "name": "example2.com", "status": "pending"},
    {"id": "test3", "name": "example3.com", "status": "moved"}
  ]'::jsonb,
  '{
    "success": true,
    "timestamp": "2025-04-23T20:34:51Z",
    "totalDomains": 5031,
    "nonActiveDomains": 3
  }'::jsonb
);

-- Verify
SELECT * FROM scan_results ORDER BY created_at DESC LIMIT 1;