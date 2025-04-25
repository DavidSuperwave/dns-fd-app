-- First check the columns
select column_name, data_type 
from information_schema.columns 
where table_schema = 'public' 
and table_name = 'user_profiles';

-- Then try to insert a test profile
insert into public.user_profiles (
  id,
  email,
  name,
  role,
  active,
  status,
  created_at
) values (
  '00000000-0000-0000-0000-000000000000',
  'test@example.com',
  'Test User',
  'user',
  true,
  'pending',
  now()
) returning *;

-- Clean up test data
delete from public.user_profiles 
where id = '00000000-0000-0000-0000-000000000000';