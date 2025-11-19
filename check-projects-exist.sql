-- Simple check: Do projects exist at all?
SELECT COUNT(*) as total_projects FROM projects;

-- Show all projects (if any exist)
SELECT 
  id,
  name,
  user_id,
  company_profile_id,
  status,
  deleted_at,
  created_at
FROM projects
ORDER BY created_at DESC;

-- Check company profiles and their workflow status
SELECT 
  id,
  client_name,
  user_id,
  workflow_status,
  completed_at,
  created_at
FROM company_profiles
ORDER BY created_at DESC;

-- Check if trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'company_profiles'
  AND trigger_name = 'on_company_profile_completed';

-- Check if function exists
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name = 'create_project_from_company_profile';

