-- Complete Rollback of Tenant Company Changes
-- This script will fully revert all changes made to extend the tenants table

-- Step 1: Drop migration function first (to avoid dependency issues)
DROP FUNCTION IF EXISTS public.migrate_users_to_tenants();

-- Step 2: Remove all RLS policies related to tenant_user_roles (must drop before schema changes)
DROP POLICY IF EXISTS "Allow tenant members to read domains" ON public.domains;
DROP POLICY IF EXISTS "Allow tenant owners and admins to manage domains" ON public.domains;
DROP POLICY IF EXISTS "Allow tenant owners to manage roles" ON public.tenant_user_roles;
DROP POLICY IF EXISTS "Allow users to read own roles" ON public.tenant_user_roles;
DROP POLICY IF EXISTS "Allow admins to read tenant_user_roles" ON public.tenant_user_roles;

-- Step 3: Remove tenant_id column from domain_assignments (this is causing the error)
ALTER TABLE IF EXISTS public.domain_assignments
DROP COLUMN IF EXISTS tenant_id;

-- Step 4: Remove tenant-related columns from pending_users
ALTER TABLE IF EXISTS public.pending_users 
DROP COLUMN IF EXISTS tenant_id,
DROP COLUMN IF EXISTS tenant_role;

-- Step 5: Drop join table for users and tenants
DROP TABLE IF EXISTS public.tenant_user_roles CASCADE;

-- Step 6: Remove indexes if they exist (should be dropped with table, but just to be safe)
DROP INDEX IF EXISTS idx_tenant_user_roles_user_id;
DROP INDEX IF EXISTS idx_tenant_user_roles_tenant_id;

-- Step 7: Keep the tenants table core structure
-- NOTE: Only uncomment these if these columns were added solely for the company model
-- and are not being used elsewhere in the application
-- ALTER TABLE IF EXISTS public.tenants 
-- DROP COLUMN IF EXISTS name,
-- DROP COLUMN IF EXISTS description,
-- DROP COLUMN IF EXISTS active;
