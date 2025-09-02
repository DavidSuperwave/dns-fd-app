-- Create a table for companies
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  contact_email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_companies_name ON public.companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_active ON public.companies(active);

-- Enable Row Level Security
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Create policies for companies table
-- Allow admins to read all companies
CREATE POLICY "Allow admins to read companies"
  ON public.companies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Allow users to read their own company
CREATE POLICY "Allow users to read their own company"
  ON public.companies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_company_roles
      WHERE user_company_roles.user_id = auth.uid()
      AND user_company_roles.company_id = companies.id
    )
  );

-- Allow admins to insert companies
CREATE POLICY "Allow admins to insert companies"
  ON public.companies FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Allow admins to update companies
CREATE POLICY "Allow admins to update companies"
  ON public.companies FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Create a join table for users and companies with roles
CREATE TABLE IF NOT EXISTS public.user_company_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'support', 'sales', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure a user only has one role per company
  UNIQUE(user_id, company_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_user_company_roles_user_id ON public.user_company_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_company_roles_company_id ON public.user_company_roles(company_id);

-- Enable Row Level Security
ALTER TABLE public.user_company_roles ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for user_company_roles
-- Allow admins to read all user_company_roles
CREATE POLICY "Allow admins to read user_company_roles"
  ON public.user_company_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Allow users to read their own roles
CREATE POLICY "Allow users to read own roles"
  ON public.user_company_roles FOR SELECT
  USING (user_id = auth.uid());

-- Allow company owners to manage roles within their company
CREATE POLICY "Allow company owners to manage roles"
  ON public.user_company_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_company_roles
      WHERE user_company_roles.user_id = auth.uid()
      AND user_company_roles.company_id = user_company_roles.company_id
      AND user_company_roles.role = 'owner'
    )
  );

-- Modify the pending_users table to include company association
ALTER TABLE public.pending_users 
ADD COLUMN company_id UUID REFERENCES companies(id),
ADD COLUMN company_role TEXT CHECK (company_role IN ('owner', 'admin', 'support', 'sales', 'user'));

-- Create a domains_companies join table to link domains with companies
CREATE TABLE IF NOT EXISTS public.company_domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  domain TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure a domain only belongs to one company
  UNIQUE(domain)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_company_domains_company_id ON public.company_domains(company_id);
CREATE INDEX IF NOT EXISTS idx_company_domains_domain ON public.company_domains(domain);

-- Enable Row Level Security
ALTER TABLE public.company_domains ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for company_domains
-- Allow admins to read all company domains
CREATE POLICY "Allow admins to read company domains"
  ON public.company_domains FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Allow company members to read their company's domains
CREATE POLICY "Allow company members to read domains"
  ON public.company_domains FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_company_roles
      WHERE user_company_roles.user_id = auth.uid()
      AND user_company_roles.company_id = company_domains.company_id
    )
  );

-- Allow company owners and admins to manage domains
CREATE POLICY "Allow company owners and admins to manage domains"
  ON public.company_domains FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_company_roles
      WHERE user_company_roles.user_id = auth.uid()
      AND user_company_roles.company_id = company_domains.company_id
      AND user_company_roles.role IN ('owner', 'admin')
    )
  );
