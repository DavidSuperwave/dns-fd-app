-- Create user_profiles table with all required columns
create table if not exists public.user_profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  name text,
  role text check (role in ('admin', 'user', 'guest')),
  active boolean default true,
  status text check (status in ('pending', 'active', 'inactive')),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  has_2fa boolean default false
);

-- Add RLS policies
alter table public.user_profiles enable row level security;

-- Allow users to read their own profile
create policy "Users can read their own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

-- Allow admin to read all profiles
create policy "Admin can read all profiles"
  on public.user_profiles for select
  using (
    exists (
      select 1 from auth.users
      where auth.users.id = auth.uid()
      and (auth.users.email = 'management@superwave.ai' 
           or auth.users.raw_user_meta_data->>'role' = 'admin')
    )
  );

-- Allow service role to manage all profiles
create policy "Service role can manage all profiles"
  on public.user_profiles for all
  using (auth.jwt() ->> 'role' = 'service_role');

-- Grant necessary permissions
grant usage on schema public to service_role, authenticated;
grant all privileges on public.user_profiles to service_role;
grant select on public.user_profiles to authenticated;