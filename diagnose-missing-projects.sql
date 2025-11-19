-- Comprehensive diagnostic: What's actually in the database?

-- 1. Check if projects table exists and has any rows
SELECT 
  'Projects Table' as check_type,
  COUNT(*) as count,
  CASE WHEN COUNT(*) > 0 THEN '✅ Has data' ELSE '❌ Empty' END as status
FROM projects;

-- 2. Check if company_profiles table exists and has any rows
SELECT 
  'Company Profiles Table' as check_type,
  COUNT(*) as count,
  CASE WHEN COUNT(*) > 0 THEN '✅ Has data' ELSE '❌ Empty' END as status
FROM company_profiles;

-- 3. Show ALL company profiles with their workflow status
SELECT 
  id,
  client_name,
  user_id,
  workflow_status,
  completed_at,
  created_at,
  CASE 
    WHEN workflow_status = 'completed' THEN '✅ Should have project'
    ELSE '⏳ Not completed yet'
  END as project_status
FROM company_profiles
ORDER BY created_at DESC;

-- 4. Show ALL projects (if any exist)
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

-- 5. Check which company profiles are completed but missing projects
SELECT 
  cp.id as company_profile_id,
  cp.client_name,
  cp.user_id,
  cp.workflow_status,
  cp.completed_at,
  p.id as project_id,
  CASE 
    WHEN p.id IS NULL THEN '❌ MISSING PROJECT'
    ELSE '✅ Has project'
  END as status
FROM company_profiles cp
LEFT JOIN projects p ON p.company_profile_id = cp.id
WHERE cp.workflow_status = 'completed'
ORDER BY cp.completed_at DESC;

-- 6. Check trigger exists
SELECT 
  'Trigger Check' as check_type,
  trigger_name,
  CASE 
    WHEN trigger_name IS NOT NULL THEN '✅ Trigger exists'
    ELSE '❌ Trigger missing'
  END as status
FROM information_schema.triggers
WHERE event_object_table = 'company_profiles'
  AND trigger_name = 'on_company_profile_completed';

