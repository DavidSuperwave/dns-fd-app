-- Add columns to link projects to external PlusVibe campaigns
ALTER TABLE company_profiles
  ADD COLUMN IF NOT EXISTS campaign_id TEXT,
  ADD COLUMN IF NOT EXISTS campaign_name TEXT,
  ADD COLUMN IF NOT EXISTS campaign_metadata JSONB DEFAULT '{}'::jsonb;

-- Helpful index for lookups by linked campaign id
CREATE INDEX IF NOT EXISTS idx_company_profiles_campaign_id
  ON company_profiles(campaign_id);

