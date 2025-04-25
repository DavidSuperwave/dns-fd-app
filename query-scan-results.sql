-- Check for records in the scan_results table
SELECT 
  id, 
  status, 
  total_domains, 
  domains_needing_attention, 
  created_at, 
  completed_at,
  scan_duration_ms
FROM 
  scan_results
ORDER BY 
  created_at DESC
LIMIT 5;

-- Insert a test record if needed
INSERT INTO public.scan_results (
  status, 
  total_domains, 
  domains_needing_attention, 
  completed_at,
  scan_duration_ms
)
VALUES (
  'completed', 
  10, 
  2, 
  now(),
  1500
)
RETURNING id, status, created_at, completed_at;