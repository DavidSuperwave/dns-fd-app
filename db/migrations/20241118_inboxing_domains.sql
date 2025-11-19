-- Inboxing domain sync + slot tracking
BEGIN;

CREATE TABLE IF NOT EXISTS public.inboxing_domains (
    id BIGSERIAL PRIMARY KEY,
    inboxing_id INTEGER NOT NULL UNIQUE,
    domain_name TEXT NOT NULL,
    status TEXT,
    admin_email TEXT,
    display_name TEXT,
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    assigned_at TIMESTAMPTZ,

    tenant_primary_domain TEXT,
    tenant_status TEXT,
    tenant_id TEXT,
    tenant_domain_limit INTEGER,

    cloudflare_email TEXT,
    cloudflare_account_id TEXT,

    last_remote_update TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,

    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inboxing_domains_inboxing_id ON public.inboxing_domains(inboxing_id);
CREATE INDEX IF NOT EXISTS idx_inboxing_domains_domain_name ON public.inboxing_domains(domain_name);
CREATE INDEX IF NOT EXISTS idx_inboxing_domains_status ON public.inboxing_domains(status);
CREATE INDEX IF NOT EXISTS idx_inboxing_domains_is_active ON public.inboxing_domains(is_active);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inboxing_domains_updated_at ON public.inboxing_domains;
CREATE TRIGGER trg_inboxing_domains_updated_at
BEFORE UPDATE ON public.inboxing_domains
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.inboxing_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role inboxing domains" ON public.inboxing_domains;
DROP POLICY IF EXISTS "authenticated read inboxing domains" ON public.inboxing_domains;

CREATE POLICY "service role inboxing domains"
  ON public.inboxing_domains
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated read inboxing domains"
  ON public.inboxing_domains
  FOR SELECT TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS public.inboxing_sync_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running',
    total_domains INTEGER DEFAULT 0,
    upserted_domains INTEGER DEFAULT 0,
    disabled_domains INTEGER DEFAULT 0,
    error TEXT,
    triggered_by UUID REFERENCES auth.users(id),
    triggered_email TEXT
);

ALTER TABLE public.inboxing_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role inboxing sync runs" ON public.inboxing_sync_runs;
DROP POLICY IF EXISTS "authenticated read inboxing sync runs" ON public.inboxing_sync_runs;

CREATE POLICY "service role inboxing sync runs"
  ON public.inboxing_sync_runs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated read inboxing sync runs"
  ON public.inboxing_sync_runs
  FOR SELECT TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS public.user_domain_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT NOT NULL,
    total_slots INTEGER NOT NULL DEFAULT 0,
    used_slots INTEGER NOT NULL DEFAULT 0,
    pending_slots INTEGER NOT NULL DEFAULT 0,
    available_slots INTEGER GENERATED ALWAYS AS (
        GREATEST(total_slots - used_slots - pending_slots, 0)
    ) STORED,
    source TEXT DEFAULT 'manual',
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_user_domain_slots_nonnegative CHECK (
        total_slots >= 0 AND used_slots >= 0 AND pending_slots >= 0
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_domain_slots_user_email ON public.user_domain_slots(user_email);
CREATE INDEX IF NOT EXISTS idx_user_domain_slots_user_id ON public.user_domain_slots(user_id);

DROP TRIGGER IF EXISTS trg_user_domain_slots_updated_at ON public.user_domain_slots;
CREATE TRIGGER trg_user_domain_slots_updated_at
BEFORE UPDATE ON public.user_domain_slots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.user_domain_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role user domain slots" ON public.user_domain_slots;
DROP POLICY IF EXISTS "authenticated read own domain slots" ON public.user_domain_slots;

CREATE POLICY "service role user domain slots"
  ON public.user_domain_slots
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated read own domain slots"
  ON public.user_domain_slots
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Extend domains table with source + inboxing linkage
ALTER TABLE public.domains
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'cloudflare',
  ADD COLUMN IF NOT EXISTS inboxing_domain_id BIGINT UNIQUE REFERENCES public.inboxing_domains(id);

CREATE INDEX IF NOT EXISTS idx_domains_source ON public.domains(source);
CREATE INDEX IF NOT EXISTS idx_domains_inboxing_domain_id ON public.domains(inboxing_domain_id);

COMMIT;

