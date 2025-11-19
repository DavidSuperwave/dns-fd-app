-- Get the manus_workflow_id (task_id) for your Plusvibe company
SELECT 
  id,
  client_name,
  manus_workflow_id as task_id,
  workflow_status
FROM company_profiles
WHERE id = '42b581ec-7aa8-4eba-9e48-e94c6bf36afa';
