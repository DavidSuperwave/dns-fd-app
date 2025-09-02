-- Company Schema Migration
-- This migration adds a dedicated schema for companies and user-company relationships
-- without using the existing tenants table

-- Step 1: Create companies table
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    website TEXT,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create user_company_memberships junction table for managing user-company relationships
CREATE TABLE IF NOT EXISTS public.user_company_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, company_id)
);

-- Step 3: Add company_id to pending_users table for company-specific invitations
ALTER TABLE IF NOT EXISTS public.pending_users
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS company_role TEXT DEFAULT 'user';

-- Step 4: Create RLS policies for the companies table
-- Allow any authenticated user to read companies
CREATE POLICY companies_select_policy ON public.companies
    FOR SELECT TO authenticated USING (true);

-- Allow admin users to insert into companies
CREATE POLICY companies_insert_policy ON public.companies
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Allow admin users to update companies
CREATE POLICY companies_update_policy ON public.companies
    FOR UPDATE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Allow admin users to delete companies
CREATE POLICY companies_delete_policy ON public.companies
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Step 5: Create RLS policies for the user_company_memberships table
-- Allow users to read their own memberships
CREATE POLICY user_company_memberships_select_policy ON public.user_company_memberships
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Allow admin users to insert into user_company_memberships
CREATE POLICY user_company_memberships_insert_policy ON public.user_company_memberships
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Allow admin users to update user_company_memberships
CREATE POLICY user_company_memberships_update_policy ON public.user_company_memberships
    FOR UPDATE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Allow admin users to delete from user_company_memberships
CREATE POLICY user_company_memberships_delete_policy ON public.user_company_memberships
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Step 6: Enable RLS on the companies and user_company_memberships tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_company_memberships ENABLE ROW LEVEL SECURITY;

-- Step 7: Create function to get all companies a user belongs to
CREATE OR REPLACE FUNCTION public.get_user_companies(p_user_id UUID)
RETURNS TABLE (
    company_id UUID,
    company_name TEXT,
    company_description TEXT,
    user_role TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id AS company_id,
        c.name AS company_name,
        c.description AS company_description,
        ucm.role AS user_role
    FROM
        public.companies c
    JOIN
        public.user_company_memberships ucm ON c.id = ucm.company_id
    WHERE
        ucm.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
