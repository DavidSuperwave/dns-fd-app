-- Create import_history table for tracking bulk import operations
CREATE TABLE IF NOT EXISTS public.import_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  type TEXT NOT NULL DEFAULT 'bulk_cloudflare_import',
  total_processed INTEGER NOT NULL DEFAULT 0,
  successful INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  options JSONB,
  errors JSONB,
  duration_ms INTEGER,
  initiated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

-- Allow admins to view all import history
CREATE POLICY "Admins can view import history"
  ON public.import_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.email = 'admin@superwave.io' OR
        auth.users.raw_user_meta_data->>'role' = 'admin'
      )
    )
  );

-- Allow admins to insert import history
CREATE POLICY "Admins can create import history"
  ON public.import_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.email = 'admin@superwave.io' OR
        auth.users.raw_user_meta_data->>'role' = 'admin'
      )
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_import_history_timestamp ON public.import_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_import_history_type ON public.import_history(type);
CREATE INDEX IF NOT EXISTS idx_import_history_initiated_by ON public.import_history(initiated_by);

-- Verify table was created
SELECT 'Import history table created successfully!' as result;
