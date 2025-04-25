-- Update the existing scan record with proper test data
UPDATE scan_results
SET 
  total_domains = 10,
  domains_needing_attention = 2,
  scan_duration_ms = 1500,
  status_breakdown = '{
    "active": 8,
    "pending": 1,
    "inactive": 1
  }'::jsonb,
  non_active_domains = '[
    {
      "id": "test1",
      "name": "example1.com",
      "status": "pending"
    },
    {
      "id": "test2", 
      "name": "example2.com",
      "status": "inactive"
    }
  ]'::jsonb,
  scan_result = '{
    "success": true,
    "timestamp": "2025-04-23T20:34:51Z",
    "domains": [
      {
        "id": "test1",
        "name": "example1.com",
        "status": "pending"
      },
      {
        "id": "test2",
        "name": "example2.com", 
        "status": "inactive"
      }
    ]
  }'::jsonb
WHERE id = (
  SELECT id 
  FROM scan_results 
  ORDER BY created_at DESC 
  LIMIT 1
);

-- Verify the update
SELECT 
  id,
  status,
  total_domains,
  domains_needing_attention,
  scan_duration_ms,
  status_breakdown,
  created_at,
  completed_at
FROM scan_results
ORDER BY created_at DESC
LIMIT 1;