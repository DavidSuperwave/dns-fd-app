-- Check if company report data is being saved
-- Run this to see what's in the company_report column

SELECT 
  id,
  client_name,
  workflow_status,
  manus_workflow_id,
  company_report,
  company_report->>'current_phase' as current_phase,
  company_report->'phase_data'->'phase_1_company_report' as phase_1_data,
  created_at,
  updated_at
FROM company_profiles
ORDER BY created_at DESC
LIMIT 5;

-- Check if phase_1_company_report exists
SELECT 
  id,
  client_name,
  workflow_status,
  CASE 
    WHEN company_report->'phase_data'->'phase_1_company_report' IS NOT NULL THEN 'YES'
    ELSE 'NO'
  END as has_phase_1_report,
  jsonb_typeof(company_report->'phase_data'->'phase_1_company_report') as phase_1_type
FROM company_profiles
WHERE workflow_status IN ('generating', 'creating_report', 'validating_report', 'finding_competitors', 'completed')
ORDER BY created_at DESC;

