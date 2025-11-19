-- Debug script to check and fix project user_id mismatches
-- Run this in your Supabase SQL editor

-- Step 1: See all projects and their user_ids
SELECT 
  p.id as project_id,
  p.name as project_name,
  p.user_id as project_user_id,
  p.status,
  p.deleted_at,
  cp.user_id as company_profile_user_id,
  cp.client_name,
  u.email as project_user_email,
  u2.email as company_profile_user_email
FROM projects p
LEFT JOIN company_profiles cp ON p.company_profile_id = cp.id
LEFT JOIN auth.users u ON p.user_id = u.id
LEFT JOIN auth.users u2 ON cp.user_id = u2.id
ORDER BY p.created_at DESC;

-- Step 2: Check if there are any mismatches
-- Projects where project.user_id != company_profile.user_id
SELECT 
  p.id,
  p.name,
  p.user_id as project_user_id,
  cp.user_id as company_profile_user_id,
  CASE 
    WHEN p.user_id != cp.user_id THEN 'MISMATCH'
    ELSE 'MATCH'
  END as status
FROM projects p
LEFT JOIN company_profiles cp ON p.company_profile_id = cp.id
WHERE cp.user_id IS NOT NULL
ORDER BY p.created_at DESC;

-- Step 3: Fix mismatches (if any)
-- This updates project.user_id to match company_profile.user_id
-- ONLY RUN THIS IF YOU SEE MISMATCHES ABOVE!
/*
UPDATE projects p
SET user_id = cp.user_id
FROM company_profiles cp
WHERE p.company_profile_id = cp.id
  AND p.user_id != cp.user_id
  AND cp.user_id IS NOT NULL;
*/

-- Step 4: Check your current logged-in user
-- Replace 'your-email@example.com' with your actual email
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'your-email@example.com';

-- Step 5: Manually fix a specific project (if needed)
-- Replace the UUIDs with actual values
/*
UPDATE projects 
SET user_id = 'YOUR_USER_ID_HERE'  -- Get from Step 4
WHERE id = 'PROJECT_ID_HERE';
*/

