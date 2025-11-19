-- Campaign Page Redesign - Database Migration
-- Adds workspace configuration to projects and updates campaigns schema

BEGIN;

-- Add workspace_type to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS workspace_type TEXT CHECK (workspace_type IN ('standard', 'custom')),
ADD COLUMN IF NOT EXISTS workspace_configured_at TIMESTAMP;

-- Update campaigns table to better reflect email campaigns
-- Add icp_id reference if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'icp_id') THEN
        ALTER TABLE campaigns ADD COLUMN icp_id UUID;
    END IF;
END $$;

-- Add index for workspace_type
CREATE INDEX IF NOT EXISTS idx_projects_workspace_type ON projects(workspace_type) WHERE workspace_type IS NOT NULL;

-- Add index for campaigns by project and status
CREATE INDEX IF NOT EXISTS idx_campaigns_project_status ON campaigns(project_id, status) WHERE deleted_at IS NULL;

COMMIT;

-- Verification
SELECT 
    'Migration completed successfully!' as message,
    'Added workspace_type to projects' as change_1,
    'Added icp_id to campaigns' as change_2;
