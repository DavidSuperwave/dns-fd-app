-- ============================================================================
-- Migration: Consolidate PlusVibe Integration
-- ============================================================================
-- This migration consolidates the old plusvibe_credentials system with the
-- new plusvibe_connections system, and ensures campaigns are properly linked
-- to projects with PlusVibe sync data.
-- ============================================================================

-- ============================================================================
-- Step 1: Ensure campaigns table has all PlusVibe fields
-- ============================================================================

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS plusvibe_campaign_id TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS plusvibe_workspace_id TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS sync_with_plusvibe BOOLEAN DEFAULT false;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS last_plusvibe_sync TIMESTAMP;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS plusvibe_sync_status TEXT 
    CHECK (plusvibe_sync_status IN ('pending', 'syncing', 'synced', 'error'));
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS plusvibe_sync_direction TEXT 
    CHECK (plusvibe_sync_direction IN ('import', 'export', 'bidirectional'));
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS plusvibe_sync_error TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT true;

-- ============================================================================
-- Step 2: Create unique index for PlusVibe campaign IDs
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_plusvibe_campaign_id_unique 
    ON campaigns(plusvibe_campaign_id) 
    WHERE plusvibe_campaign_id IS NOT NULL;

-- ============================================================================
-- Step 3: Add indexes for project-campaign queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_campaigns_project_id ON campaigns(project_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_project_sync 
    ON campaigns(project_id, sync_with_plusvibe);
CREATE INDEX IF NOT EXISTS idx_campaigns_sync_status 
    ON campaigns(sync_with_plusvibe, plusvibe_sync_status, last_plusvibe_sync)
    WHERE sync_with_plusvibe = true;

-- ============================================================================
-- Step 4: Migrate data from old plusvibe_credentials table (if it exists)
-- ============================================================================

DO $$
BEGIN
    -- Check if old table exists
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'plusvibe_credentials'
    ) THEN
        
        RAISE NOTICE 'Found old plusvibe_credentials table, migrating data...';
        
        -- Migrate credentials to new connections table
        INSERT INTO plusvibe_connections (
            user_id,
            workspace_id,
            api_key,
            connection_name,
            is_active,
            is_default,
            created_at,
            updated_at
        )
        SELECT DISTINCT
            cp.user_id,
            pc.workspace_id,
            pc.api_key,
            COALESCE(pc.label, 'Migrated from ' || cp.client_name),
            true,
            COALESCE(pc.is_default, false),
            pc.created_at,
            COALESCE(pc.updated_at, pc.created_at)
        FROM plusvibe_credentials pc
        JOIN company_profiles cp ON cp.id = pc.company_profile_id
        WHERE NOT EXISTS (
            SELECT 1 FROM plusvibe_connections 
            WHERE user_id = cp.user_id 
            AND workspace_id = pc.workspace_id
        );

        RAISE NOTICE 'Migrated credentials successfully';
        
    ELSE
        RAISE NOTICE 'Old plusvibe_credentials table not found, skipping credential migration';
    END IF;
END $$;

-- ============================================================================
-- Step 5: Migrate campaign linkages from company_profiles
-- ============================================================================

DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Update campaigns table with PlusVibe data from company_profiles
    UPDATE campaigns c
    SET 
        plusvibe_campaign_id = cp.campaign_id,
        plusvibe_workspace_id = cp.campaign_workspace_id,
        sync_with_plusvibe = (cp.campaign_id IS NOT NULL),
        plusvibe_sync_status = CASE 
            WHEN cp.campaign_id IS NOT NULL THEN 'synced'
            ELSE NULL
        END,
        plusvibe_sync_direction = CASE
            WHEN cp.campaign_id IS NOT NULL THEN 'bidirectional'
            ELSE NULL
        END,
        auto_sync_enabled = (cp.campaign_id IS NOT NULL)
    FROM projects p
    JOIN company_profiles cp ON cp.id = p.company_profile_id
    WHERE c.project_id = p.id
    AND c.plusvibe_campaign_id IS NULL
    AND cp.campaign_id IS NOT NULL;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Linked % campaigns to PlusVibe', updated_count;
END $$;

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
    conn_count INTEGER;
    synced_count INTEGER;
    total_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO conn_count FROM plusvibe_connections;
    SELECT COUNT(*) INTO synced_count FROM campaigns WHERE plusvibe_campaign_id IS NOT NULL;
    SELECT COUNT(*) INTO total_count FROM campaigns;
    
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Migration Summary:';
    RAISE NOTICE 'Total PlusVibe Connections: %', conn_count;
    RAISE NOTICE 'Synced Campaigns: %', synced_count;
    RAISE NOTICE 'Total Campaigns: %', total_count;
    RAISE NOTICE '===========================================';
END $$;
