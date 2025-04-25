-- Create scan_results table for direct execution in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS public.scan_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
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

-- Insert a dummy record to make sure the useLatestScan hook doesn't fail
INSERT INTO public.scan_results (status, total_domains, domains_needing_attention, completed_at)
VALUES ('completed', 0, 0, now())
ON CONFLICT DO NOTHING;