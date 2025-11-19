-- Find company profiles without Manus tasks and get their IDs
-- Use these IDs to manually retry task creation via API

SELECT 
  id,
  client_name,
  workflow_status,
  manus_workflow_id,
  created_at,
  CASE 
    WHEN manus_workflow_id IS NULL THEN '❌ No Task - Needs Retry'
    ELSE '✅ Task Exists'
  END as status
FROM company_profiles
WHERE manus_workflow_id IS NULL
  AND workflow_status = 'pending'
ORDER BY created_at DESC;

-- To retry: Use the company profile ID with the retry endpoint
-- POST /api/company-profiles/[id]/retry-manus-task

