-- Create scan_results table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.scan_results (
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scan_results_status ON public.scan_results(status);
CREATE INDEX IF NOT EXISTS idx_scan_results_completed_at ON public.scan_results(completed_at DESC);

-- Enable Row Level Security
ALTER TABLE public.scan_results ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow authenticated users to READ scan results (needed for frontend progress/dashboard)
DROP POLICY IF EXISTS "Authenticated users can read scan results" ON public.scan_results;
CREATE POLICY "Authenticated users can read scan results"
  ON public.scan_results FOR SELECT
  TO authenticated
  USING (true);

-- Policy 2: Allow service role (API) to do EVERYTHING
DROP POLICY IF EXISTS "Service role full access" ON public.scan_results;
CREATE POLICY "Service role full access"
  ON public.scan_results FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_scan_results_updated_at ON public.scan_results;
CREATE TRIGGER update_scan_results_updated_at
BEFORE UPDATE ON public.scan_results
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT ON public.scan_results TO authenticated;
GRANT ALL ON public.scan_results TO service_role;
