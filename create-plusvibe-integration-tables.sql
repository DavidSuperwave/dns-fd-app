-- ============================================================================
-- Database Migration: PlusVibe Integration Tables
-- ============================================================================
-- This migration creates tables for PlusVibe API integration:
-- 1. plusvibe_connections - User-level API credentials and workspace connections
-- 2. plusvibe_sync_history - Track all sync operations and their results
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. PLUSVIBE CONNECTIONS TABLE
-- ============================================================================
-- Stores user-level PlusVibe API credentials and workspace connections
CREATE TABLE IF NOT EXISTS plusvibe_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Connection Details
  workspace_id TEXT NOT NULL,
  api_key TEXT NOT NULL, -- TODO: Encrypt in production
  connection_name TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- Default connection for this user
  
  -- Sync Status
  last_sync_at TIMESTAMP,
  last_sync_status TEXT CHECK (last_sync_status IN ('success', 'failed', 'partial')),
  last_sync_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, workspace_id) -- One connection per workspace per user
);

-- Indexes for plusvibe_connections
CREATE INDEX IF NOT EXISTS idx_plusvibe_connections_user_id ON plusvibe_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_plusvibe_connections_is_active ON plusvibe_connections(is_active);
CREATE INDEX IF NOT EXISTS idx_plusvibe_connections_is_default ON plusvibe_connections(is_default);

-- ============================================================================
-- 2. PLUSVIBE SYNC HISTORY TABLE
-- ============================================================================
-- Track all sync operations between local database and PlusVibe
CREATE TABLE IF NOT EXISTS plusvibe_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES plusvibe_connections(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  
  -- Sync Details
  sync_type TEXT NOT NULL CHECK (sync_type IN (
    'import_campaign',
    'export_campaign',
    'sync_leads',
    'sync_emails',
    'sync_replies',
    'full_sync'
  )),
  sync_direction TEXT NOT NULL CHECK (sync_direction IN (
    'to_plusvibe',
    'from_plusvibe',
    'bidirectional'
  )),
  
  -- Sync Statistics
  items_processed INTEGER DEFAULT 0,
  items_successful INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  items_skipped INTEGER DEFAULT 0,
  
  -- Status and Errors
  status TEXT DEFAULT 'processing' CHECK (status IN (
    'processing',
    'completed',
    'failed',
    'partial'
  )),
  error_message TEXT,
  error_details JSONB DEFAULT '{}',
  
  -- Performance Metrics
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_ms INTEGER
);

-- Indexes for plusvibe_sync_history
CREATE INDEX IF NOT EXISTS idx_plusvibe_sync_history_user_id ON plusvibe_sync_history(user_id);
CREATE INDEX IF NOT EXISTS idx_plusvibe_sync_history_connection_id ON plusvibe_sync_history(connection_id);
CREATE INDEX IF NOT EXISTS idx_plusvibe_sync_history_campaign_id ON plusvibe_sync_history(campaign_id);
CREATE INDEX IF NOT EXISTS idx_plusvibe_sync_history_sync_type ON plusvibe_sync_history(sync_type);
CREATE INDEX IF NOT EXISTS idx_plusvibe_sync_history_status ON plusvibe_sync_history(status);
CREATE INDEX IF NOT EXISTS idx_plusvibe_sync_history_started_at ON plusvibe_sync_history(started_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE plusvibe_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE plusvibe_sync_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: PLUSVIBE_CONNECTIONS
-- ============================================================================

-- Users can view their own connections
CREATE POLICY "Users can view their own PlusVibe connections"
  ON plusvibe_connections FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own connections
CREATE POLICY "Users can create their own PlusVibe connections"
  ON plusvibe_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own connections
CREATE POLICY "Users can update their own PlusVibe connections"
  ON plusvibe_connections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own connections
CREATE POLICY "Users can delete their own PlusVibe connections"
  ON plusvibe_connections FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can manage all connections
CREATE POLICY "Service role can manage all PlusVibe connections"
  ON plusvibe_connections FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- RLS POLICIES: PLUSVIBE_SYNC_HISTORY
-- ============================================================================

-- Users can view their own sync history
CREATE POLICY "Users can view their own PlusVibe sync history"
  ON plusvibe_sync_history FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all sync history
CREATE POLICY "Service role can manage all PlusVibe sync history"
  ON plusvibe_sync_history FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- TRIGGERS: Auto-update updated_at timestamps
-- ============================================================================

-- Apply trigger to plusvibe_connections
CREATE TRIGGER update_plusvibe_connections_updated_at
  BEFORE UPDATE ON plusvibe_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================
SELECT 'PlusVibe integration tables created successfully!' as result;
