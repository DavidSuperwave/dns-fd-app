-- Verify table exists and has correct columns
select 
    column_name,
    data_type,
    is_nullable,
    column_default
from information_schema.columns
where table_schema = 'public'
and table_name = 'user_profiles'
order by ordinal_position;

-- Verify policies
select *
from pg_policies
where schemaname = 'public'
and tablename = 'user_profiles';

-- Verify RLS is enabled
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
and tablename = 'user_profiles';