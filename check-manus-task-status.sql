-- Check if Manus task was created for a company profile
-- Replace 'YOUR_COMPANY_NAME' with your actual company name

-- Option 1: Find by company name
SELECT 
  cp.id,
  cp.client_name,
  cp.workflow_status,
  cp.manus_workflow_id,
  cp.company_report->>'current_phase' as current_phase,
  cp.company_report->'phases_completed' as phases_completed,
  cp.created_at,
  p.id as project_id,
  p.name as project_name
FROM company_profiles cp
LEFT JOIN projects p ON p.company_profile_id = cp.id
WHERE cp.client_name ILIKE '%superwave%'  -- Change this to your company name
ORDER BY cp.created_at DESC;

-- Option 2: Get all recent company profiles with Manus tasks
SELECT 
  cp.id,
  cp.client_name,
  cp.workflow_status,
  cp.manus_workflow_id,
  cp.company_report->>'current_phase' as current_phase,
  CASE 
    WHEN cp.manus_workflow_id IS NOT NULL THEN '✅ Task Created'
    ELSE '❌ No Task'
  END as task_status,
  cp.created_at
FROM company_profiles cp
ORDER BY cp.created_at DESC
LIMIT 10;

-- Option 3: Check specific company profile (replace UUID)
-- SELECT 
--   id,
--   client_name,
--   workflow_status,
--   manus_workflow_id,
--   company_report,
--   created_at
-- FROM company_profiles
-- WHERE id = 'YOUR_COMPANY_PROFILE_ID_HERE';

