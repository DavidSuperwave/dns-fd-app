-- Create scan_results table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.scan_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL CHECK (status IN ('initializing', 'fetching', 'processing', 'completed', 'failed')),
  progress_current INTEGER NOT NULL DEFAULT 0,
  progress_total INTEGER NOT NULL DEFAULT 0,
  progress_percentage INTEGER NOT NULL DEFAULT 0,
  total_domains INTEGER NOT NULL DEFAULT 0,
  domains_needing_attention INTEGER NOT NULL DEFAULT 0,
  scan_duration_ms INTEGER,
  failed_reason TEXT,
  -- scan_result JSONB structure:
  -- {
  --   success: boolean,
  --   timestamp: string,
  --   totalDomains: number,
  --   nonActiveDomains: number,
  --   progress: { current: number, total: number, percentage: number }
  -- }
  scan_result JSONB,
  -- status_breakdown JSONB structure:
  -- {
  --   active: number,
  --   pending: number,
  --   moved: number,
  --   deactivated: number,
  --   initializing: number,
  --   read_only: number
  -- }
  status_breakdown JSONB,
  non_active_domains JSONB
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_scan_results_status ON scan_results(status);
CREATE INDEX IF NOT EXISTS idx_scan_results_completed_at ON scan_results(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_results_created_at ON scan_results(created_at DESC);

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
INSERT INTO public.scan_results (status, started_at, total_domains, domains_needing_attention, completed_at)
VALUES ('completed', now(), 0, 0, now())
ON CONFLICT DO NOTHING;