-- Check if projects exist and find company profiles without projects
-- Run this to see what's missing

-- Step 1: Count projects
SELECT COUNT(*) as total_projects FROM projects;

-- Step 2: Find company profiles that are 'completed' but have no project
SELECT 
  cp.id as company_profile_id,
  cp.client_name,
  cp.user_id,
  cp.workflow_status,
  cp.completed_at,
  p.id as project_id
FROM company_profiles cp
LEFT JOIN projects p ON p.company_profile_id = cp.id
WHERE cp.workflow_status = 'completed'
  AND p.id IS NULL  -- No project exists for this company profile
ORDER BY cp.completed_at DESC;

-- Step 3: Create missing projects for completed company profiles
-- This will create projects for any company profiles that are 'completed' but don't have a project yet
INSERT INTO projects (user_id, company_profile_id, name, logo_url, status)
SELECT 
  cp.user_id,
  cp.id,
  cp.client_name,
  cp.logo_url,
  'active'
FROM company_profiles cp
LEFT JOIN projects p ON p.company_profile_id = cp.id
WHERE cp.workflow_status = 'completed'
  AND p.id IS NULL  -- Only create if project doesn't exist
RETURNING id, name, user_id, company_profile_id;

-- Step 4: Verify projects were created
SELECT 
  p.id,
  p.name,
  p.user_id,
  p.company_profile_id,
  p.status,
  cp.client_name,
  cp.workflow_status
FROM projects p
JOIN company_profiles cp ON p.company_profile_id = cp.id
ORDER BY p.created_at DESC;

