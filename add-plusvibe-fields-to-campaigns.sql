-- ============================================================================
-- Database Migration: Add PlusVibe Sync Fields to Campaigns Table
-- ============================================================================
-- This migration adds PlusVibe integration fields to the existing campaigns table
-- to support bidirectional synchronization with PlusVibe API
-- ============================================================================

BEGIN;

-- ============================================================================
-- Add PlusVibe Integration Columns to Campaigns
-- ============================================================================

-- PlusVibe Campaign ID (external reference)
ALTER TABLE campaigns 
  ADD COLUMN IF NOT EXISTS plusvibe_campaign_id TEXT;

-- PlusVibe Workspace ID (for multi-workspace support)
ALTER TABLE campaigns 
  ADD COLUMN IF NOT EXISTS plusvibe_workspace_id TEXT;

-- Sync Configuration
ALTER TABLE campaigns 
  ADD COLUMN IF NOT EXISTS sync_with_plusvibe BOOLEAN DEFAULT false;

-- Last Sync Timestamp
ALTER TABLE campaigns 
  ADD COLUMN IF NOT EXISTS last_plusvibe_sync TIMESTAMP;

-- Sync Status
ALTER TABLE campaigns 
  ADD COLUMN IF NOT EXISTS plusvibe_sync_status TEXT 
  CHECK (plusvibe_sync_status IN ('pending', 'syncing', 'synced', 'error'));

-- Sync Direction
ALTER TABLE campaigns 
  ADD COLUMN IF NOT EXISTS plusvibe_sync_direction TEXT 
  CHECK (plusvibe_sync_direction IN ('import', 'export', 'bidirectional'));

-- Sync Error Message
ALTER TABLE campaigns 
  ADD COLUMN IF NOT EXISTS plusvibe_sync_error TEXT;

-- Auto-sync Configuration (default true per user requirement)
ALTER TABLE campaigns 
  ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT true;

-- ============================================================================
-- Add Unique Constraint
-- ============================================================================
-- Ensure one-to-one mapping between local campaigns and PlusVibe campaigns

-- First, create unique index (allows NULL values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_plusvibe_campaign_id_unique 
  ON campaigns(plusvibe_campaign_id) 
  WHERE plusvibe_campaign_id IS NOT NULL;

-- ============================================================================
-- Add Indexes for Performance
-- ============================================================================

-- Index for filtering synced campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_sync_with_plusvibe 
  ON campaigns(sync_with_plusvibe) 
  WHERE sync_with_plusvibe = true;

-- Index for monitoring sync status
CREATE INDEX IF NOT EXISTS idx_campaigns_plusvibe_sync_status 
  ON campaigns(plusvibe_sync_status);

-- Index for auto-sync queries
CREATE INDEX IF NOT EXISTS idx_campaigns_auto_sync_enabled 
  ON campaigns(auto_sync_enabled) 
  WHERE auto_sync_enabled = true;

-- Index for workspace-based queries
CREATE INDEX IF NOT EXISTS idx_campaigns_plusvibe_workspace_id 
  ON campaigns(plusvibe_workspace_id) 
  WHERE plusvibe_workspace_id IS NOT NULL;

-- Composite index for finding campaigns needing sync
CREATE INDEX IF NOT EXISTS idx_campaigns_auto_sync_status 
  ON campaigns(auto_sync_enabled, plusvibe_sync_status, last_plusvibe_sync)
  WHERE auto_sync_enabled = true;

COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================
SELECT 
  'PlusVibe fields added to campaigns table successfully!' as result,
  COUNT(*) as total_campaigns,
  COUNT(plusvibe_campaign_id) as synced_campaigns
FROM campaigns;
