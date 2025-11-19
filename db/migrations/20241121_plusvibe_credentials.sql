-- Store PlusVibe API credentials per company profile and link them to projects
BEGIN;

-- Ensure pgcrypto is available if we later choose to encrypt secrets
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.plusvibe_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_profile_id UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  api_key TEXT NOT NULL,
  label TEXT,
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_plusvibe_credentials_company
  ON public.plusvibe_credentials(company_profile_id);

CREATE INDEX IF NOT EXISTS idx_plusvibe_credentials_default
  ON public.plusvibe_credentials(company_profile_id, is_default)
  WHERE is_default IS TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_plusvibe_credentials_unique_label
  ON public.plusvibe_credentials(company_profile_id, label)
  WHERE label IS NOT NULL;

DROP TRIGGER IF EXISTS trg_plusvibe_credentials_updated_at ON public.plusvibe_credentials;
CREATE TRIGGER trg_plusvibe_credentials_updated_at
BEFORE UPDATE ON public.plusvibe_credentials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.plusvibe_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role plusvibe credentials" ON public.plusvibe_credentials;
DROP POLICY IF EXISTS "owner manage plusvibe credentials" ON public.plusvibe_credentials;

CREATE POLICY "service role plusvibe credentials"
  ON public.plusvibe_credentials
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "owner manage plusvibe credentials"
  ON public.plusvibe_credentials
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_profiles cp
      WHERE cp.id = plusvibe_credentials.company_profile_id
        AND cp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.company_profiles cp
      WHERE cp.id = plusvibe_credentials.company_profile_id
        AND cp.user_id = auth.uid()
    )
  );

ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS current_plusvibe_credentials_id UUID REFERENCES public.plusvibe_credentials(id),
  ADD COLUMN IF NOT EXISTS plusvibe_settings JSONB DEFAULT '{}'::jsonb;

COMMIT;


