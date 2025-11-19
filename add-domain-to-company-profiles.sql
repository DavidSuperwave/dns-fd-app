-- Add domain column to company_profiles table
ALTER TABLE company_profiles
ADD COLUMN IF NOT EXISTS domain TEXT;

-- Add comment for documentation
COMMENT ON COLUMN company_profiles.domain IS 'The company website domain (e.g., example.com)';
