-- Debug Phase 2 Data Structure
-- Run this in Supabase SQL Editor to see what's actually stored

SELECT 
  id,
  client_name,
  workflow_status,
  company_report->'current_phase' as current_phase,
  company_report->'phases_completed' as phases_completed,
  -- Check if phase_2 data exists
  CASE 
    WHEN company_report->'phase_data'->'phase_2_icp_report' IS NOT NULL 
    THEN 'phase_2_icp_report exists'
    ELSE 'phase_2_icp_report missing'
  END as phase_2_status,
  -- Check structure
  jsonb_typeof(company_report->'phase_data'->'phase_2_icp_report') as phase_2_type,
  -- Check for icp_reports array
  CASE 
    WHEN company_report->'phase_data'->'phase_2_icp_report'->'icp_reports' IS NOT NULL 
    THEN jsonb_array_length(company_report->'phase_data'->'phase_2_icp_report'->'icp_reports')
    ELSE 0
  END as icp_count,
  -- Show first few keys of phase_2_icp_report
  jsonb_object_keys(company_report->'phase_data'->'phase_2_icp_report') as top_level_keys
FROM company_profiles
WHERE workflow_status = 'icp_ready'
ORDER BY created_at DESC
LIMIT 1;
