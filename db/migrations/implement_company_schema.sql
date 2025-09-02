-- Company Schema Implementation
-- This script creates the company-related tables needed for the company feature
-- and establishes relationships with existing user and domain tables

BEGIN;

-- Step 1: Create the companies table with all needed fields
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES auth.users(id), -- The user who created this company
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    website_url TEXT,
    logo_url TEXT,
    plan_type TEXT DEFAULT 'Standard', -- Enterprise, Business, Professional, Standard, Basic
    subscription_type TEXT DEFAULT 'Monthly', -- Annual, Monthly
    status TEXT DEFAULT 'Active', -- Active, Pending, Suspended
    join_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    contact_email TEXT,
    employee_size INTEGER DEFAULT 0,
    location TEXT,
    industry TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create a user_company_memberships junction table for managing user-company relationships
CREATE TABLE IF NOT EXISTS public.user_company_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'user', -- admin, user, billing, viewer
    department TEXT,
    job_title TEXT,
    join_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, company_id)
);

-- Step 3: Create a company_domains table to associate domains with companies
CREATE TABLE IF NOT EXISTS public.company_domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    domain_id INTEGER NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
    added_by UUID REFERENCES auth.users(id),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    primary_domain BOOLEAN DEFAULT false,
    UNIQUE(company_id, domain_id)
);

-- Step 4: Create a company_invitations table for inviting users to companies
CREATE TABLE IF NOT EXISTS public.company_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    token TEXT NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, declined, expired
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + interval '7 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 5: Create an admin_emails table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.admin_emails (
    email TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 6: Create RLS policies for the companies table
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to read companies they are a member of or created
CREATE POLICY companies_select_policy ON public.companies
    FOR SELECT TO authenticated USING (
        creator_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.user_company_memberships
            WHERE user_id = auth.uid() AND company_id = companies.id
        ) OR 
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() AND email IN (SELECT email FROM public.admin_emails)
        )
    );

-- Allow authenticated users to insert companies they're creating (creator_id must match their uid)
CREATE POLICY companies_insert_policy ON public.companies
    FOR INSERT TO authenticated WITH CHECK (
        auth.uid() = creator_id OR
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() AND email IN (SELECT email FROM public.admin_emails)
        )
    );

-- Allow creators and company admins to update companies
CREATE POLICY companies_update_policy ON public.companies
    FOR UPDATE TO authenticated USING (
        auth.uid() = creator_id OR
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() AND email IN (SELECT email FROM public.admin_emails)
        ) OR
        EXISTS (
            SELECT 1 FROM public.user_company_memberships
            WHERE user_id = auth.uid() AND company_id = companies.id AND role = 'admin'
        )
    );

-- Step 7: Create RLS policies for the user_company_memberships table
ALTER TABLE public.user_company_memberships ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own company memberships and admins to read all
CREATE POLICY user_company_memberships_select_policy ON public.user_company_memberships
    FOR SELECT TO authenticated USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() AND email IN (SELECT email FROM public.admin_emails)
        ) OR
        EXISTS (
            SELECT 1 FROM public.user_company_memberships ucm
            JOIN public.companies c ON ucm.company_id = c.id
            WHERE ucm.user_id = auth.uid() AND ucm.role = 'admin' AND ucm.company_id = user_company_memberships.company_id
        )
    );

-- Allow company admins and global admins to manage memberships
CREATE POLICY user_company_memberships_insert_policy ON public.user_company_memberships
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() AND email IN (SELECT email FROM public.admin_emails)
        ) OR
        EXISTS (
            SELECT 1 FROM public.user_company_memberships
            WHERE user_id = auth.uid() AND company_id = company_id AND role = 'admin'
        ) OR
        -- Allow users to accept invitations for themselves
        (auth.uid() = user_id AND 
         EXISTS (
             SELECT 1 FROM public.company_invitations
             WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
             AND company_id = company_id
             AND status = 'pending'
         ))
    );

-- Step 8: Create RLS policies for company_domains
ALTER TABLE public.company_domains ENABLE ROW LEVEL SECURITY;

-- Allow company members to read company domains
CREATE POLICY company_domains_select_policy ON public.company_domains
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.user_company_memberships
            WHERE user_id = auth.uid() AND company_id = company_domains.company_id
        ) OR
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() AND email IN (SELECT email FROM public.admin_emails)
        )
    );

-- Allow company admins to manage domains
CREATE POLICY company_domains_insert_policy ON public.company_domains
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_company_memberships
            WHERE user_id = auth.uid() AND company_id = company_id AND role IN ('admin', 'owner')
        ) OR
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() AND email IN (SELECT email FROM public.admin_emails)
        )
    );

-- Step 9: Create RLS policies for company_invitations
ALTER TABLE public.company_invitations ENABLE ROW LEVEL SECURITY;

-- Allow company admins and invited users to see invitations
CREATE POLICY company_invitations_select_policy ON public.company_invitations
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.user_company_memberships
            WHERE user_id = auth.uid() AND company_id = company_invitations.company_id AND role IN ('admin', 'owner')
        ) OR
        (SELECT email FROM auth.users WHERE id = auth.uid()) = company_invitations.email OR
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() AND email IN (SELECT email FROM public.admin_emails)
        )
    );

-- Allow company admins to create invitations
CREATE POLICY company_invitations_insert_policy ON public.company_invitations
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_company_memberships
            WHERE user_id = auth.uid() AND company_id = company_id AND role IN ('admin', 'owner')
        ) OR
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() AND email IN (SELECT email FROM public.admin_emails)
        )
    );

-- Function to check if user is company admin or global admin
CREATE OR REPLACE FUNCTION public.is_admin_of_company(company_id UUID) 
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        EXISTS (
            SELECT 1 FROM public.user_company_memberships
            WHERE user_id = auth.uid() 
            AND company_id = $1
            AND role IN ('admin', 'owner')
        ) OR
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() 
            AND email IN (SELECT email FROM public.admin_emails)
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all companies for a user
CREATE OR REPLACE FUNCTION public.get_user_companies(user_id UUID DEFAULT auth.uid()) 
RETURNS TABLE (
    company_id UUID,
    name TEXT,
    role TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as company_id,
        c.name,
        ucm.role,
        c.created_at
    FROM 
        public.companies c
    JOIN 
        public.user_company_memberships ucm ON c.id = ucm.company_id
    WHERE 
        ucm.user_id = $1
    ORDER BY 
        c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_company_memberships_user_id ON public.user_company_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_company_memberships_company_id ON public.user_company_memberships(company_id);
CREATE INDEX IF NOT EXISTS idx_company_domains_company_id ON public.company_domains(company_id);
CREATE INDEX IF NOT EXISTS idx_company_domains_domain_id ON public.company_domains(domain_id);
CREATE INDEX IF NOT EXISTS idx_companies_creator_id ON public.companies(creator_id);
CREATE INDEX IF NOT EXISTS idx_companies_slug ON public.companies(slug);

COMMIT;
