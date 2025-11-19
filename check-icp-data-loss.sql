-- Check if Phase 2 ICP data still exists after Phase 3/4/5
SELECT 
  id,
  client_name,
  workflow_status,
  company_report->'current_phase' as current_phase,
  company_report->'phases_completed' as phases_completed,
  jsonb_array_length(company_report->'phase_data'->'phase_2_icp_report'->'icp_reports') as icp_count,
  company_report->'phase_data'->'phase_2_icp_report'->'icp_reports' as icp_data
FROM company_profiles
WHERE id = '42b581ec-7aa8-4eba-9e48-e94c6bf36afa';
