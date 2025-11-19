-- Fix Phase 2 ICP Data
-- This replaces the incorrect Phase 1 data in phase_2_icp_report with the correct ICP data

-- IMPORTANT: Replace the icp_reports array below with your full ICP data that you pasted earlier
-- The data should start with the full JSON object you showed me

UPDATE company_profiles
SET company_report = jsonb_set(
  company_report,
  '{phase_data,phase_2_icp_report}',
  '{
    "icp_reports": [
      -- PASTE YOUR FULL ICP ARRAY HERE
      -- It should be the 3 ICPs (ICP-001, ICP-002, ICP-003) with all their sub-niches
    ]
  }'::jsonb
)
WHERE id = '42b581ec-7aa8-4eba-9e48-e94c6bf36afa';

-- Verify the fix worked
SELECT 
  id,
  client_name,
  workflow_status,
  jsonb_array_length(company_report->'phase_data'->'phase_2_icp_report'->'icp_reports') as icp_count
FROM company_profiles
WHERE id = '42b581ec-7aa8-4eba-9e48-e94c6bf36afa';
