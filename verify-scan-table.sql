-- Verify the scan_results table was created successfully
SELECT 
  table_name,
  column_name,
  data_type
FROM 
  information_schema.columns
WHERE 
  table_name = 'scan_results'
ORDER BY 
  ordinal_position;

-- Check if any rows exist in the table
SELECT 
  id, 
  status, 
  total_domains, 
  domains_needing_attention, 
  created_at, 
  completed_at 
FROM 
  scan_results
ORDER BY 
  created_at DESC
LIMIT 5;

-- Check RLS policies
SELECT 
  tablename,
  policyname,
  permissive, 
  cmd, 
  qual
FROM 
  pg_policies 
WHERE 
  tablename = 'scan_results';