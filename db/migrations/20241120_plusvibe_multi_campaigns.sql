-- Support multiple PlusVibe campaigns per company and track uploads/activity

CREATE TABLE IF NOT EXISTS plusvibe_campaign_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_profile_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT,
  workspace_id TEXT,
  status TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  linked_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_plusvibe_campaign_links_company
  ON plusvibe_campaign_links(company_profile_id);

CREATE INDEX IF NOT EXISTS idx_plusvibe_campaign_links_campaign_id
  ON plusvibe_campaign_links(campaign_id);

ALTER TABLE company_profiles
  ADD COLUMN IF NOT EXISTS current_campaign_link UUID REFERENCES plusvibe_campaign_links(id),
  ADD COLUMN IF NOT EXISTS campaign_workspace_id TEXT,
  ADD COLUMN IF NOT EXISTS campaign_linked_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS plusvibe_lead_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_link_id UUID NOT NULL REFERENCES plusvibe_campaign_links(id) ON DELETE CASCADE,
  file_name TEXT,
  row_count INTEGER,
  plusvibe_job_id TEXT,
  status TEXT DEFAULT 'pending',
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_plusvibe_lead_uploads_campaign
  ON plusvibe_lead_uploads(campaign_link_id);

CREATE TABLE IF NOT EXISTS plusvibe_campaign_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_link_id UUID NOT NULL REFERENCES plusvibe_campaign_links(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  metric_value NUMERIC,
  payload JSONB,
  recorded_by UUID REFERENCES auth.users(id),
  collected_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plusvibe_campaign_activity_campaign
  ON plusvibe_campaign_activity(campaign_link_id);

CREATE INDEX IF NOT EXISTS idx_plusvibe_campaign_activity_metric_type
  ON plusvibe_campaign_activity(metric_type);

