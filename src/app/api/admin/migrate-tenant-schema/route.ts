import { createAdminClient } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const supabase = createAdminClient();

    // SQL migration for extending tenants to function as companies
    const sql = `
    -- Extend tenants table with additional fields for company model
    ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS name TEXT;
    ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
    
    -- Create tenant_user_roles join table for user-tenant relationships with roles
    CREATE TABLE IF NOT EXISTS public.tenant_user_roles (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'support', 'sales', 'user')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      UNIQUE(tenant_id, user_id)
    );
    
    -- Add tenant_id to pending_users to support company invitations
    ALTER TABLE public.pending_users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
    ALTER TABLE public.pending_users ADD COLUMN IF NOT EXISTS tenant_role TEXT CHECK (tenant_role IN ('owner', 'admin', 'support', 'sales', 'user'));
    
    -- Add indexes for performance
    CREATE INDEX IF NOT EXISTS idx_tenant_user_roles_tenant_id ON public.tenant_user_roles(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_tenant_user_roles_user_id ON public.tenant_user_roles(user_id);
    CREATE INDEX IF NOT EXISTS idx_pending_users_tenant_id ON public.pending_users(tenant_id);
    
    -- RLS Policies for tenant_user_roles
    -- Drop existing policies if any (to allow recreation)
    DROP POLICY IF EXISTS tenant_user_roles_select_policy ON public.tenant_user_roles;
    DROP POLICY IF EXISTS tenant_user_roles_insert_policy ON public.tenant_user_roles;
    DROP POLICY IF EXISTS tenant_user_roles_update_policy ON public.tenant_user_roles;
    DROP POLICY IF EXISTS tenant_user_roles_delete_policy ON public.tenant_user_roles;
    
    -- Enable RLS on tenant_user_roles
    ALTER TABLE public.tenant_user_roles ENABLE ROW LEVEL SECURITY;
    
    -- Create RLS policies for tenant_user_roles
    CREATE POLICY tenant_user_roles_select_policy 
      ON public.tenant_user_roles 
      FOR SELECT 
      USING (
        auth.uid() IN (
          SELECT user_id FROM public.tenant_user_roles 
          WHERE tenant_id = tenant_user_roles.tenant_id
        ) 
        OR 
        auth.uid() IN (SELECT id FROM auth.users WHERE is_admin = true)
      );
    
    CREATE POLICY tenant_user_roles_insert_policy 
      ON public.tenant_user_roles 
      FOR INSERT 
      WITH CHECK (
        auth.uid() IN (
          SELECT user_id FROM public.tenant_user_roles 
          WHERE tenant_id = tenant_user_roles.tenant_id AND role IN ('owner', 'admin')
        ) 
        OR 
        auth.uid() IN (SELECT id FROM auth.users WHERE is_admin = true)
      );
    
    CREATE POLICY tenant_user_roles_update_policy 
      ON public.tenant_user_roles 
      FOR UPDATE 
      USING (
        auth.uid() IN (
          SELECT user_id FROM public.tenant_user_roles 
          WHERE tenant_id = tenant_user_roles.tenant_id AND role IN ('owner', 'admin')
        ) 
        OR 
        auth.uid() IN (SELECT id FROM auth.users WHERE is_admin = true)
      );
    
    CREATE POLICY tenant_user_roles_delete_policy 
      ON public.tenant_user_roles 
      FOR DELETE 
      USING (
        auth.uid() IN (
          SELECT user_id FROM public.tenant_user_roles 
          WHERE tenant_id = tenant_user_roles.tenant_id AND role IN ('owner', 'admin')
        ) 
        OR 
        auth.uid() IN (SELECT id FROM auth.users WHERE is_admin = true)
      );
      
    -- Create migration function to convert existing users to tenants
    CREATE OR REPLACE FUNCTION migrate_users_to_tenants()
    RETURNS void AS $$
    DECLARE
      user_record RECORD;
      tenant_id UUID;
    BEGIN
      -- Loop through user_profiles
      FOR user_record IN SELECT * FROM public.user_profiles
      LOOP
        -- Create a tenant for each user (if not already migrated)
        INSERT INTO public.tenants (admin_email, name, max_domains)
        VALUES (user_record.email, 
                COALESCE(user_record.name, 'Company - ' || user_record.email), 
                100)
        RETURNING id INTO tenant_id;
        
        -- Create tenant_user_roles entry for this user as owner
        INSERT INTO public.tenant_user_roles (tenant_id, user_id, role)
        VALUES (tenant_id, user_record.id, 'owner');
        
        -- If user has domains, associate them with the tenant
        UPDATE public.domains
        SET tenant_id = tenant_id
        WHERE id = ANY(user_record.domains);
      END LOOP;
    END;
    $$ LANGUAGE plpgsql;
    `;
    
    // Execute the SQL migration
    const { error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error("Migration error:", error);
      return NextResponse.json({ success: false, error }, { status: 500 });
    }
    
    // Run the migration function to convert existing users to tenants
    const { error: migrationError } = await supabase.rpc('exec_sql', { 
      sql: 'SELECT migrate_users_to_tenants()' 
    });
    
    if (migrationError) {
      console.error("User migration error:", migrationError);
      return NextResponse.json({ success: false, error: migrationError }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Server error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
