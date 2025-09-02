-- Quick fix for domain_assignments table
-- Run this in the Supabase SQL editor to fix the immediate error

-- Remove tenant_id from domain_assignments which is causing the error
ALTER TABLE IF EXISTS public.domain_assignments
DROP COLUMN IF EXISTS tenant_id;
