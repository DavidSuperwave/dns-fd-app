-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the scan_results table
CREATE TABLE IF NOT EXISTS public.scan_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  error TEXT,
  total_domains INTEGER NOT NULL DEFAULT 0,
  domains_needing_attention INTEGER NOT NULL DEFAULT 0,
  scan_duration_ms INTEGER,
  scan_result JSONB,
  status_breakdown JSONB,
  non_active_domains JSONB
);

-- Enable Row Level Security
ALTER TABLE public.scan_results ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all authenticated users to view scan results
CREATE POLICY "Allow authenticated users to view scan results" 
  ON public.scan_results
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policy to allow authenticated users to insert scan results
CREATE POLICY "Allow authenticated users to create scan results" 
  ON public.scan_results
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create policy to allow authenticated users to update scan results
CREATE POLICY "Allow authenticated users to update scan results" 
  ON public.scan_results
  FOR UPDATE
  TO authenticated
  USING (true);

-- Insert initial test data
INSERT INTO public.scan_results (
  status,
  total_domains,
  domains_needing_attention,
  scan_duration_ms,
  status_breakdown,
  non_active_domains,
  scan_result
) VALUES (
  'completed',
  10,
  2,
  1500,
  '{
    "active": 8,
    "pending": 1,
    "inactive": 1
  }'::jsonb,
  '[
    {
      "id": "test1",
      "name": "example1.com",
      "status": "pending"
    },
    {
      "id": "test2",
      "name": "example2.com",
      "status": "inactive"
    }
  ]'::jsonb,
  '{
    "success": true,
    "timestamp": "2025-04-23T20:34:51Z",
    "domains": [
      {
        "id": "test1",
        "name": "example1.com",
        "status": "pending"
      },
      {
        "id": "test2",
        "name": "example2.com",
        "status": "inactive"
      }
    ]
  }'::jsonb
);

-- Verify the table was created and data was inserted
SELECT 
  id,
  status,
  total_domains,
  domains_needing_attention,
  scan_duration_ms,
  created_at,
  completed_at
FROM scan_results
ORDER BY created_at DESC
LIMIT 1;