-- User-Company Relationship Schema Migration
-- This migration adds a relationship between users and companies (tenants)
-- allowing users to be assigned to companies with specific roles

-- Step 1: Make sure tenants table has necessary fields
ALTER TABLE IF NOT EXISTS public.tenants
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS admin_email TEXT,
ADD COLUMN IF NOT EXISTS max_domains INTEGER DEFAULT 5;

-- Step 2: Create user_company_roles junction table for managing user-company relationships
CREATE TABLE IF NOT EXISTS public.user_company_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, company_id)
);

-- Step 3: Add tenant_id to pending_users table to support company-specific invitations
ALTER TABLE IF NOT EXISTS public.pending_users
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS tenant_role TEXT DEFAULT 'user';

-- Step 4: Create RLS policies for the user_company_roles table
-- Allow users to read their own company roles
CREATE POLICY user_company_roles_select_policy ON public.user_company_roles
    FOR SELECT USING (auth.uid() = user_id);

-- Allow admin users to insert into user_company_roles
CREATE POLICY user_company_roles_insert_policy ON public.user_company_roles
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Allow admin users to update user_company_roles
CREATE POLICY user_company_roles_update_policy ON public.user_company_roles
    FOR UPDATE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Allow admin users to delete from user_company_roles
CREATE POLICY user_company_roles_delete_policy ON public.user_company_roles
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Step 5: Enable RLS on the user_company_roles table
ALTER TABLE public.user_company_roles ENABLE ROW LEVEL SECURITY;

-- Step 6: Create function to get all companies a user belongs to
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
        t.id AS company_id,
        t.name AS company_name,
        t.description AS company_description,
        ucr.role AS user_role
    FROM
        public.tenants t
    JOIN
        public.user_company_roles ucr ON t.id = ucr.company_id
    WHERE
        ucr.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
