-- Extend the tenants table to fully support the company model
-- Add name and description fields if they don't exist
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

-- Create a join table for users and tenants with roles
CREATE TABLE IF NOT EXISTS public.tenant_user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'support', 'sales', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure a user only has one role per tenant
  UNIQUE(user_id, tenant_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_tenant_user_roles_user_id ON public.tenant_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_user_roles_tenant_id ON public.tenant_user_roles(tenant_id);

-- Enable Row Level Security
ALTER TABLE public.tenant_user_roles ENABLE ROW LEVEL SECURITY;

-- Modify the pending_users table to include tenant association
ALTER TABLE public.pending_users 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id),
ADD COLUMN IF NOT EXISTS tenant_role TEXT CHECK (tenant_role IN ('owner', 'admin', 'support', 'sales', 'user'));

-- Add RLS policies for tenant_user_roles

-- Allow system admins to read all tenant_user_roles
CREATE POLICY "Allow admins to read tenant_user_roles"
  ON public.tenant_user_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Allow users to read their own roles
CREATE POLICY "Allow users to read own roles"
  ON public.tenant_user_roles FOR SELECT
  USING (user_id = auth.uid());

-- Allow tenant owners to manage roles within their tenant
CREATE POLICY "Allow tenant owners to manage roles"
  ON public.tenant_user_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tenant_user_roles
      WHERE tenant_user_roles.user_id = auth.uid()
      AND tenant_user_roles.tenant_id = tenant_user_roles.tenant_id
      AND tenant_user_roles.role = 'owner'
    )
  );

-- Add RLS policies for domains to allow tenant-based access
-- (if not already present)

-- Allow tenant members to read their tenant's domains
CREATE POLICY "Allow tenant members to read domains"
  ON public.domains FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenant_user_roles
      WHERE tenant_user_roles.user_id = auth.uid()
      AND tenant_user_roles.tenant_id = domains.tenant_id
    )
  );

-- Allow tenant owners and admins to manage domains
CREATE POLICY "Allow tenant owners and admins to manage domains"
  ON public.domains FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tenant_user_roles
      WHERE tenant_user_roles.user_id = auth.uid()
      AND tenant_user_roles.tenant_id = domains.tenant_id
      AND tenant_user_roles.role IN ('owner', 'admin')
    )
  );

-- Update domain_assignments to use tenant_id instead of user_email
ALTER TABLE public.domain_assignments
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Function to migrate existing users to the new structure
-- This creates a tenant for each existing user if needed
CREATE OR REPLACE FUNCTION public.migrate_users_to_tenants()
RETURNS VOID AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- For each active user
  FOR user_record IN 
    SELECT * FROM user_profiles 
    WHERE status = 'active'
  LOOP
    -- Check if user already has a tenant as owner
    IF NOT EXISTS (
      SELECT 1 FROM tenants 
      WHERE owner_id = user_record.id
    ) THEN
      -- Create a tenant for this user if they don't have one
      INSERT INTO tenants (
        admin_email, 
        owner_id, 
        max_domains, 
        name
      ) VALUES (
        user_record.email,
        user_record.id,
        100, -- Default max domains
        CONCAT(user_record.name, '''s Organization') -- Default name
      );
    END IF;
    
    -- Get the tenant_id for this user
    DECLARE
      user_tenant_id UUID;
    BEGIN
      SELECT id INTO user_tenant_id 
      FROM tenants 
      WHERE owner_id = user_record.id
      LIMIT 1;
      
      -- Add user to tenant_user_roles if not already there
      IF NOT EXISTS (
        SELECT 1 FROM tenant_user_roles
        WHERE user_id = user_record.id 
        AND tenant_id = user_tenant_id
      ) THEN
        INSERT INTO tenant_user_roles (
          user_id,
          tenant_id,
          role
        ) VALUES (
          user_record.id,
          user_tenant_id,
          'owner'
        );
      END IF;
      
      -- Update any domains owned by this user to be owned by their tenant
      UPDATE domains
      SET tenant_id = user_tenant_id
      WHERE user_id = user_record.id
      AND tenant_id IS NULL;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- To run the migration:
-- SELECT public.migrate_users_to_tenants();
