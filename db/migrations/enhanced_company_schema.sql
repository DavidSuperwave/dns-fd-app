-- Enhanced Company Schema Migration
-- This migration creates a comprehensive company table with all fields needed
-- for the quick action menu profile display and user-to-company relationships

-- Step 1: Create the companies table with all profile fields
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

-- Step 3: Create RLS policies for the companies table
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
        auth.uid() = NEW.creator_id OR
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

-- Step 4: Create RLS policies for the user_company_memberships table
-- Allow users to read their own company memberships
CREATE POLICY user_company_memberships_select_policy ON public.user_company_memberships
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() AND email IN (SELECT email FROM public.admin_emails)
        )
    );

-- Allow admin users to insert into user_company_memberships
CREATE POLICY user_company_memberships_insert_policy ON public.user_company_memberships
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() AND email IN (SELECT email FROM public.admin_emails)
        ) OR
        EXISTS (
            SELECT 1 FROM public.user_company_memberships
            WHERE user_id = auth.uid() AND company_id = NEW.company_id AND role = 'admin'
        )
    );

-- Allow admin users to update user_company_memberships
CREATE POLICY user_company_memberships_update_policy ON public.user_company_memberships
    FOR UPDATE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() AND email IN (SELECT email FROM public.admin_emails)
        ) OR
        EXISTS (
            SELECT 1 FROM public.user_company_memberships
            WHERE user_id = auth.uid() AND company_id = OLD.company_id AND role = 'admin'
        )
    );

-- Step 5: Create admin_emails table to manage admin access
CREATE TABLE IF NOT EXISTS public.admin_emails (
    email TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert at least one admin email
INSERT INTO public.admin_emails (email) VALUES ('admin@example.com');

-- Step 6: Create a helper function to automatically add the creator as a company admin when a company is created
CREATE OR REPLACE FUNCTION public.add_company_creator_as_admin()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_company_memberships (user_id, company_id, role)
    VALUES (NEW.creator_id, NEW.id, 'admin');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger to run the function automatically
CREATE TRIGGER add_company_creator_as_admin_trigger
AFTER INSERT ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.add_company_creator_as_admin();

-- Step 7: Insert sample company data (same as what we used in the quick action menu)
-- Note: We need a valid user_id in the database to set as creator_id
-- For now, we'll use a placeholder that should be replaced with actual user IDs
DO $$ 
DECLARE
    admin_user_id UUID;
BEGIN
    -- Try to get a valid user ID from the auth.users table
    SELECT id INTO admin_user_id FROM auth.users LIMIT 1;
    
    -- If no users exist yet, we'll create sample data when users are available
    IF admin_user_id IS NOT NULL THEN
        -- Insert sample companies with the admin user as creator
        INSERT INTO public.companies (id, creator_id, name, slug, description, website_url, plan_type, subscription_type, status, join_date, contact_email, employee_size, location, industry)
        VALUES
            ('11111111-1111-1111-1111-111111111111', admin_user_id, 'Acme Corporation', 'acme-corp', 'Leading provider of innovative solutions', 'https://acme.example.com', 'Enterprise', 'Annual', 'Active', '2024-01-15', 'contact@acme.example.com', 1500, 'New York, USA', 'Technology'),
            ('22222222-2222-2222-2222-222222222222', admin_user_id, 'Globex Industries', 'globex', 'Global manufacturing excellence', 'https://globex.example.com', 'Business', 'Monthly', 'Active', '2024-03-22', 'info@globex.example.com', 850, 'Chicago, USA', 'Manufacturing'),
            ('33333333-3333-3333-3333-333333333333', admin_user_id, 'Soylent Corp', 'soylent', 'Sustainable food solutions', 'https://soylent.example.com', 'Professional', 'Annual', 'Active', '2024-02-10', 'hello@soylent.example.com', 320, 'San Francisco, USA', 'Food & Agriculture'),
            ('44444444-4444-4444-4444-444444444444', admin_user_id, 'Initech', 'initech', 'Enterprise software solutions', 'https://initech.example.com', 'Standard', 'Monthly', 'Active', '2024-05-05', 'support@initech.example.com', 75, 'Austin, USA', 'Software'),
            ('55555555-5555-5555-5555-555555555555', admin_user_id, 'Umbrella Corp', 'umbrella', 'Healthcare innovations', 'https://umbrella.example.com', 'Enterprise', 'Annual', 'Active', '2024-04-18', 'contact@umbrella.example.com', 2200, 'Boston, USA', 'Healthcare')
        ON CONFLICT (slug) DO NOTHING;
    END IF;
END $$;
