-- Check scan_results table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public'
AND table_name = 'scan_results';

-- Check a sample record
SELECT completed_at, updated_at
FROM scan_results
ORDER BY created_at DESC
LIMIT 1;