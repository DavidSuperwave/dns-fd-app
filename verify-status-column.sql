-- Check if status column exists and has correct constraints
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'user_profiles'
AND column_name = 'status';

-- Check existing data
SELECT id, email, status 
FROM public.user_profiles;

-- Try inserting a new test profile
INSERT INTO public.user_profiles (
    id,
    email,
    name,
    role,
    active,
    status,
    created_at
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'test-status@example.com',
    'Test Status User',
    'user',
    true,
    'pending',
    now()
) RETURNING *;

-- Clean up test data
DELETE FROM public.user_profiles 
WHERE id = '11111111-1111-1111-1111-111111111111';