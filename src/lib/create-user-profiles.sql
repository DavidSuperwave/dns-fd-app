-- Run this script in the Supabase SQL Editor to create the user_profiles table
-- This will ensure users appear in the user list

-- Create the user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT CHECK (role IN ('admin', 'user', 'guest')),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  domains TEXT[] DEFAULT '{}'::TEXT[],
  totp_enabled BOOLEAN DEFAULT FALSE
);

-- Create row level security policies
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile
CREATE POLICY "Allow users to read their own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);
  
-- Allow admins to read all profiles
CREATE POLICY "Allow admins to read all profiles"
  ON public.user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.email = 'management@superwave.ai' OR
        auth.users.raw_user_meta_data->>'role' = 'admin'
      )
    )
  );

-- Allow admins to insert profiles
CREATE POLICY "Allow admins to insert profiles"
  ON public.user_profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.email = 'management@superwave.ai' OR
        auth.users.raw_user_meta_data->>'role' = 'admin'
      )
    )
  );

-- Allow admins to update profiles
CREATE POLICY "Allow admins to update profiles"
  ON public.user_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.email = 'management@superwave.ai' OR
        auth.users.raw_user_meta_data->>'role' = 'admin'
      )
    )
  );

-- Allow admins to delete profiles
CREATE POLICY "Allow admins to delete profiles"
  ON public.user_profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.email = 'management@superwave.ai' OR
        auth.users.raw_user_meta_data->>'role' = 'admin'
      )
    )
  );

-- Insert profiles for existing users if they don't exist already
INSERT INTO public.user_profiles (id, email, name, role, active)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'name', SPLIT_PART(email, '@', 1), 'User'),
  CASE
    WHEN email = 'management@superwave.ai' THEN 'admin'
    WHEN raw_user_meta_data->>'role' IS NOT NULL THEN raw_user_meta_data->>'role'
    ELSE 'user'
  END,
  TRUE
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Log the results
SELECT COUNT(*) as profiles_count FROM public.user_profiles;