-- ============================================================================
-- Complete Database Schema Migration
-- ============================================================================
-- This migration creates ALL tables needed for the Superwave platform:
-- 0. Domains & Domain Assignments (infrastructure)
-- 1. Vibe Plus Integration (connections, sync history)
-- 2. Campaigns (with Vibe Plus sync support)
-- 3. Email Templates
-- 4. Leads & Lead Imports
-- 5. Email Sent (tracks emails sent via Vibe Plus - synced from Vibe Plus)
-- 6. Email Replies (tracks replies from Vibe Plus - synced from Vibe Plus)
-- 7. Reply Imports
-- 8. Manus AI Queries
--
-- IMPORTANT: All email sending is handled by Vibe Plus, not the platform.
-- email_sent and email_replies are for tracking data synced FROM Vibe Plus.
-- ============================================================================
--
-- PREREQUISITES: 
-- - Run create-company-profiles-and-projects.sql FIRST to create projects table
-- ============================================================================

BEGIN;

-- Check if required tables exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects') THEN
    RAISE EXCEPTION 'Projects table does not exist. Please run create-company-profiles-and-projects.sql first.';
  END IF;
END $$;

-- ============================================================================
-- 0. DOMAINS TABLE (Infrastructure)
-- ============================================================================
CREATE TABLE IF NOT EXISTS domains (
  id SERIAL PRIMARY KEY,
  cloudflare_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT,
  paused BOOLEAN DEFAULT FALSE,
  type TEXT,
  created_on TIMESTAMP WITH TIME ZONE,
  modified_on TIMESTAMP WITH TIME ZONE,
  last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Redirect Configuration
  redirect_url TEXT,
  redirect_url_last_updated TIMESTAMP WITH TIME ZONE,
  
  -- Deployment Status
  deployment_status TEXT, -- 'Deploying', 'PENDING', 'PROCESSING', 'Deployed', etc.
  inboxing_job_id INTEGER, -- Inboxing deployment job ID
  inboxing_job_status TEXT, -- Status from Inboxing API
  
  -- File Storage
  has_files BOOLEAN DEFAULT FALSE
);

-- Indexes for domains
CREATE INDEX IF NOT EXISTS idx_domains_cloudflare_id ON domains(cloudflare_id);
CREATE INDEX IF NOT EXISTS idx_domains_user_id ON domains(user_id);
CREATE INDEX IF NOT EXISTS idx_domains_name ON domains(name);
CREATE INDEX IF NOT EXISTS idx_domains_status ON domains(status);
CREATE INDEX IF NOT EXISTS idx_domains_deployment_status ON domains(deployment_status);

-- Enable RLS for domains
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;

-- RLS Policies for domains
DROP POLICY IF EXISTS "Enable read access for all users" ON domains;
DROP POLICY IF EXISTS "Enable write access for service role" ON domains;
DROP POLICY IF EXISTS "Users can view their own domains" ON domains;
DROP POLICY IF EXISTS "Users can update their own domains" ON domains;

CREATE POLICY "Enable read access for all users"
  ON domains FOR SELECT
  USING (true);

CREATE POLICY "Enable write access for service role"
  ON domains FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own domains"
  ON domains FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own domains"
  ON domains FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 0.1. DOMAIN ASSIGNMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS domain_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id INTEGER REFERENCES domains(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT
);

-- Indexes for domain_assignments
CREATE INDEX IF NOT EXISTS idx_domain_assignments_domain_id ON domain_assignments(domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_assignments_user_email ON domain_assignments(user_email);
CREATE INDEX IF NOT EXISTS idx_domain_assignments_user_id ON domain_assignments(user_id);

-- Enable RLS for domain_assignments
ALTER TABLE domain_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for domain_assignments
DROP POLICY IF EXISTS "Enable read access for all users" ON domain_assignments;
DROP POLICY IF EXISTS "Enable write access for service role" ON domain_assignments;
DROP POLICY IF EXISTS "Users can view their own assignments" ON domain_assignments;

CREATE POLICY "Enable read access for all users"
  ON domain_assignments FOR SELECT
  USING (true);

CREATE POLICY "Enable write access for service role"
  ON domain_assignments FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own assignments"
  ON domain_assignments FOR SELECT
  USING (auth.uid() = user_id OR user_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- ============================================================================
-- 1. VIBE PLUS CONNECTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS vibe_plus_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- API Credentials
  api_key TEXT NOT NULL,
  api_secret TEXT,
  connection_name TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP,
  last_sync_status TEXT CHECK (last_sync_status IN ('success', 'failed', 'partial')),
  last_sync_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for vibe_plus_connections
CREATE INDEX IF NOT EXISTS idx_vibe_plus_connections_user_id ON vibe_plus_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_vibe_plus_connections_is_active ON vibe_plus_connections(is_active);

-- ============================================================================
-- 2. VIBE PLUS SYNC HISTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS vibe_plus_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES vibe_plus_connections(id) ON DELETE CASCADE,
  
  -- Sync Details
  sync_type TEXT NOT NULL CHECK (sync_type IN ('campaigns', 'emails_sent', 'replies', 'full')),
  date_range_start TIMESTAMP,
  date_range_end TIMESTAMP,
  
  -- Sync Statistics
  campaigns_synced INTEGER DEFAULT 0,
  emails_sent_synced INTEGER DEFAULT 0,
  replies_synced INTEGER DEFAULT 0,
  leads_synced INTEGER DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed', 'partial')),
  error_message TEXT,
  
  -- Timestamps
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_ms INTEGER
);

-- Indexes for vibe_plus_sync_history
CREATE INDEX IF NOT EXISTS idx_vibe_plus_sync_history_user_id ON vibe_plus_sync_history(user_id);
CREATE INDEX IF NOT EXISTS idx_vibe_plus_sync_history_connection_id ON vibe_plus_sync_history(connection_id);
CREATE INDEX IF NOT EXISTS idx_vibe_plus_sync_history_status ON vibe_plus_sync_history(status);
CREATE INDEX IF NOT EXISTS idx_vibe_plus_sync_history_started_at ON vibe_plus_sync_history(started_at);

-- ============================================================================
-- 3. CAMPAIGNS TABLE (with Vibe Plus integration)
-- ============================================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Vibe Plus Integration
  vibe_plus_campaign_id TEXT, -- External campaign ID from Vibe Plus
  vibe_plus_campaign_name TEXT, -- Campaign name from Vibe Plus (for syncing)
  sync_with_vibe_plus BOOLEAN DEFAULT false,
  last_vibe_plus_sync TIMESTAMP,
  
  -- Campaign Settings
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  
  -- Email Settings
  from_email TEXT,
  from_name TEXT,
  reply_to_email TEXT,
  
  -- Domain Assignment (FK constraint added conditionally below if domains table exists)
  domain_id INTEGER, -- References domains(id) - FK added conditionally
  inboxing_job_id INTEGER, -- Inboxing deployment job ID
  
  -- Analytics (calculated from email_sent and email_replies)
  total_leads INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  total_opens INTEGER DEFAULT 0,
  open_rate DECIMAL(5,2),
  reply_rate DECIMAL(5,2),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP -- Soft delete
);

-- Indexes for campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_project_id ON campaigns(project_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_domain_id ON campaigns(domain_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_vibe_plus_campaign_id ON campaigns(vibe_plus_campaign_id) WHERE vibe_plus_campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_deleted_at ON campaigns(deleted_at) WHERE deleted_at IS NULL;

-- Add FK constraint to domains (domains table is created above)
DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'campaigns_domain_id_fkey' 
    AND table_name = 'campaigns'
  ) THEN
    ALTER TABLE campaigns 
    ADD CONSTRAINT campaigns_domain_id_fkey 
    FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 4. EMAIL TEMPLATES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  
  -- Template Information
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT,
  
  -- Template Type
  template_type TEXT DEFAULT 'outreach' CHECK (template_type IN ('outreach', 'follow_up', 'reply', 'nurture')),
  sequence_position INTEGER, -- For multi-step sequences (1, 2, 3, etc.)
  
  -- Personalization Variables
  variables JSONB DEFAULT '{}', -- Available variables: {{firstName}}, {{company}}, etc.
  
  -- Usage Tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- Default template for campaign
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for email_templates
CREATE INDEX IF NOT EXISTS idx_email_templates_user_id ON email_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_project_id ON email_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_campaign_id ON email_templates(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_template_type ON email_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_email_templates_is_active ON email_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_email_templates_campaign_sequence ON email_templates(campaign_id, sequence_position) WHERE campaign_id IS NOT NULL;

-- ============================================================================
-- 5. LEAD IMPORTS TABLE (create before leads table for FK reference)
-- ============================================================================
CREATE TABLE IF NOT EXISTS lead_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  
  -- Import Details
  source TEXT NOT NULL CHECK (source IN ('inboxing', 'vibe_plus', 'manus_ai', 'manual_import', 'csv', 'platform_upload')),
  import_type TEXT NOT NULL CHECK (import_type IN ('bulk', 'sync', 'manual')),
  
  -- Import Statistics
  total_processed INTEGER NOT NULL DEFAULT 0,
  successful INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  
  -- Import Data
  options JSONB DEFAULT '{}', -- Import options/parameters
  errors JSONB DEFAULT '[]', -- Array of error objects
  file_name TEXT, -- If imported from file
  
  -- Status
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed', 'partial')),
  
  -- Timestamps
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_ms INTEGER
);

-- Indexes for lead_imports
CREATE INDEX IF NOT EXISTS idx_lead_imports_user_id ON lead_imports(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_imports_project_id ON lead_imports(project_id);
CREATE INDEX IF NOT EXISTS idx_lead_imports_campaign_id ON lead_imports(campaign_id);
CREATE INDEX IF NOT EXISTS idx_lead_imports_source ON lead_imports(source);
CREATE INDEX IF NOT EXISTS idx_lead_imports_status ON lead_imports(status);
CREATE INDEX IF NOT EXISTS idx_lead_imports_started_at ON lead_imports(started_at);

-- ============================================================================
-- 6. LEADS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  
  -- Lead Information
  name TEXT NOT NULL,
  email TEXT,
  company TEXT,
  title TEXT,
  phone TEXT,
  website TEXT,
  
  -- Source Tracking
  source TEXT NOT NULL CHECK (source IN ('inboxing', 'vibe_plus', 'manus_ai', 'manual_import', 'csv', 'platform_upload')),
  source_id TEXT, -- External ID from source system
  source_data JSONB DEFAULT '{}', -- Full data from source system
  
  -- Lead Status
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'nurture', 'converted', 'lost')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  
  -- Additional Data
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  custom_fields JSONB DEFAULT '{}',
  
  -- Import Tracking
  imported_at TIMESTAMP DEFAULT NOW(),
  imported_by UUID REFERENCES auth.users(id),
  import_batch_id UUID REFERENCES lead_imports(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_contacted_at TIMESTAMP,
  
  -- Unique constraint: prevent duplicate leads from same source
  UNIQUE(source, source_id)
);

-- Indexes for leads
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_project_id ON leads(project_id);
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_import_batch_id ON leads(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);

-- ============================================================================
-- 7. EMAIL SENT TABLE (IMPORTANT: tracks emails sent via Vibe Plus - synced FROM Vibe Plus)
-- ============================================================================
-- NOTE: All email sending is handled by Vibe Plus, not the platform.
-- This table stores emails synced FROM Vibe Plus for tracking/analytics.
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  
  -- Email Information (synced from Vibe Plus)
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,
  to_name TEXT,
  subject TEXT NOT NULL,
  body_text TEXT,
  body_html TEXT,
  
  -- Tracking
  message_id TEXT UNIQUE, -- Unique email message ID
  thread_id TEXT, -- Email thread/conversation ID
  
  -- Vibe Plus Integration (REQUIRED - all emails come from Vibe Plus)
  vibe_plus_email_id TEXT NOT NULL, -- External email ID from Vibe Plus
  vibe_plus_campaign_id TEXT, -- Campaign ID from Vibe Plus (for syncing with campaigns)
  vibe_plus_campaign_name TEXT, -- Campaign name from Vibe Plus
  
  -- Email Status (from Vibe Plus)
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'bounced', 'failed')),
  opened_at TIMESTAMP, -- First open time (from Vibe Plus)
  open_count INTEGER DEFAULT 0, -- Open count (from Vibe Plus)
  clicked_at TIMESTAMP, -- First click time (from Vibe Plus)
  click_count INTEGER DEFAULT 0, -- Click count (from Vibe Plus)
  
  -- Source Data (full data from Vibe Plus API)
  source_data JSONB DEFAULT '{}', -- Full data from Vibe Plus
  
  -- Sync Tracking
  synced_at TIMESTAMP DEFAULT NOW(), -- When synced from Vibe Plus
  last_synced_at TIMESTAMP, -- Last time this record was updated from Vibe Plus
  
  -- Timestamps
  sent_at TIMESTAMP NOT NULL, -- When email was sent (from Vibe Plus)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for email_sent
CREATE INDEX IF NOT EXISTS idx_email_sent_user_id ON email_sent(user_id);
CREATE INDEX IF NOT EXISTS idx_email_sent_project_id ON email_sent(project_id);
CREATE INDEX IF NOT EXISTS idx_email_sent_campaign_id ON email_sent(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_sent_lead_id ON email_sent(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_sent_from_email ON email_sent(from_email);
CREATE INDEX IF NOT EXISTS idx_email_sent_to_email ON email_sent(to_email);
CREATE INDEX IF NOT EXISTS idx_email_sent_message_id ON email_sent(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_sent_thread_id ON email_sent(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_sent_sent_at ON email_sent(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_sent_status ON email_sent(status);
CREATE INDEX IF NOT EXISTS idx_email_sent_vibe_plus_email_id ON email_sent(vibe_plus_email_id);
CREATE INDEX IF NOT EXISTS idx_email_sent_vibe_plus_campaign_id ON email_sent(vibe_plus_campaign_id) WHERE vibe_plus_campaign_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_sent_vibe_plus_email_id_unique ON email_sent(vibe_plus_email_id); -- Prevent duplicate syncs

-- ============================================================================
-- 8. REPLY IMPORTS TABLE (create before email_replies for FK reference)
-- ============================================================================
CREATE TABLE IF NOT EXISTS reply_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  
  -- Import Details
  source TEXT NOT NULL CHECK (source IN ('vibe_plus', 'manual_import')), -- All replies come from Vibe Plus
  import_type TEXT NOT NULL CHECK (import_type IN ('bulk', 'sync', 'manual')),
  
  -- Import Statistics
  total_processed INTEGER NOT NULL DEFAULT 0,
  successful INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  
  -- Import Data
  options JSONB DEFAULT '{}', -- Import options/parameters
  errors JSONB DEFAULT '[]', -- Array of error objects
  date_range_start TIMESTAMP, -- If importing date range
  date_range_end TIMESTAMP,
  
  -- Status
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed', 'partial')),
  
  -- Timestamps
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_ms INTEGER
);

-- Indexes for reply_imports
CREATE INDEX IF NOT EXISTS idx_reply_imports_user_id ON reply_imports(user_id);
CREATE INDEX IF NOT EXISTS idx_reply_imports_project_id ON reply_imports(project_id);
CREATE INDEX IF NOT EXISTS idx_reply_imports_campaign_id ON reply_imports(campaign_id);
CREATE INDEX IF NOT EXISTS idx_reply_imports_source ON reply_imports(source);
CREATE INDEX IF NOT EXISTS idx_reply_imports_status ON reply_imports(status);
CREATE INDEX IF NOT EXISTS idx_reply_imports_started_at ON reply_imports(started_at);

-- ============================================================================
-- 9. EMAIL REPLIES TABLE (tracks replies from Vibe Plus - synced FROM Vibe Plus)
-- ============================================================================
-- NOTE: All replies are handled by Vibe Plus, not the platform.
-- This table stores replies synced FROM Vibe Plus for tracking/analytics.
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  email_sent_id UUID REFERENCES email_sent(id) ON DELETE SET NULL, -- Reply to which sent email (from Vibe Plus)
  
  -- Email Information (synced from Vibe Plus)
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,
  to_name TEXT,
  subject TEXT NOT NULL,
  body_text TEXT,
  body_html TEXT,
  
  -- Thread Tracking
  thread_id TEXT, -- Email thread/conversation ID
  in_reply_to TEXT, -- Message ID this is replying to
  message_id TEXT UNIQUE, -- Unique email message ID
  
  -- Vibe Plus Integration (REQUIRED - all replies come from Vibe Plus)
  vibe_plus_reply_id TEXT NOT NULL, -- External reply ID from Vibe Plus
  vibe_plus_campaign_id TEXT, -- Campaign ID from Vibe Plus (for syncing with campaigns)
  vibe_plus_campaign_name TEXT, -- Campaign name from Vibe Plus
  
  -- Reply Analysis (can be populated from Vibe Plus or manually)
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  intent TEXT, -- 'interested', 'not_interested', 'request_info', 'meeting_request', etc.
  is_auto_reply BOOLEAN DEFAULT false,
  
  -- Status
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived')),
  
  -- Source Data (full data from Vibe Plus API)
  source_data JSONB DEFAULT '{}', -- Full data from Vibe Plus
  
  -- Sync Tracking
  synced_at TIMESTAMP DEFAULT NOW(), -- When synced from Vibe Plus
  last_synced_at TIMESTAMP, -- Last time this record was updated from Vibe Plus
  imported_at TIMESTAMP DEFAULT NOW(), -- Alias for synced_at (for consistency)
  imported_by UUID REFERENCES auth.users(id),
  import_batch_id UUID REFERENCES reply_imports(id) ON DELETE SET NULL,
  
  -- Timestamps
  received_at TIMESTAMP NOT NULL, -- When email was received (from Vibe Plus)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for email_replies
CREATE INDEX IF NOT EXISTS idx_email_replies_user_id ON email_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_project_id ON email_replies(project_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_campaign_id ON email_replies(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_lead_id ON email_replies(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_email_sent_id ON email_replies(email_sent_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_from_email ON email_replies(from_email);
CREATE INDEX IF NOT EXISTS idx_email_replies_to_email ON email_replies(to_email);
CREATE INDEX IF NOT EXISTS idx_email_replies_thread_id ON email_replies(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_replies_message_id ON email_replies(message_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_received_at ON email_replies(received_at);
CREATE INDEX IF NOT EXISTS idx_email_replies_status ON email_replies(status);
CREATE INDEX IF NOT EXISTS idx_email_replies_import_batch_id ON email_replies(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_vibe_plus_reply_id ON email_replies(vibe_plus_reply_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_vibe_plus_campaign_id ON email_replies(vibe_plus_campaign_id) WHERE vibe_plus_campaign_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_replies_vibe_plus_reply_id_unique ON email_replies(vibe_plus_reply_id); -- Prevent duplicate syncs

-- ============================================================================
-- 10. MANUS AI QUERIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS manus_ai_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  
  -- Query Information
  query_text TEXT NOT NULL,
  query_type TEXT,
  result_data JSONB,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Indexes for manus_ai_queries
CREATE INDEX IF NOT EXISTS idx_manus_ai_queries_user_id ON manus_ai_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_manus_ai_queries_campaign_id ON manus_ai_queries(campaign_id);
CREATE INDEX IF NOT EXISTS idx_manus_ai_queries_project_id ON manus_ai_queries(project_id);
CREATE INDEX IF NOT EXISTS idx_manus_ai_queries_status ON manus_ai_queries(status);
CREATE INDEX IF NOT EXISTS idx_manus_ai_queries_created_at ON manus_ai_queries(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE vibe_plus_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE vibe_plus_sync_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sent ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE manus_ai_queries ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: VIBE PLUS CONNECTIONS
-- ============================================================================

CREATE POLICY "Users can view their own vibe plus connections"
  ON vibe_plus_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own vibe plus connections"
  ON vibe_plus_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vibe plus connections"
  ON vibe_plus_connections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vibe plus connections"
  ON vibe_plus_connections FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all vibe plus connections"
  ON vibe_plus_connections FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- RLS POLICIES: VIBE PLUS SYNC HISTORY
-- ============================================================================

CREATE POLICY "Users can view their own vibe plus sync history"
  ON vibe_plus_sync_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own vibe plus sync history"
  ON vibe_plus_sync_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all vibe plus sync history"
  ON vibe_plus_sync_history FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- RLS POLICIES: CAMPAIGNS
-- ============================================================================

CREATE POLICY "Users can view their own campaigns"
  ON campaigns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns"
  ON campaigns FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns (soft delete)"
  ON campaigns FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all campaigns"
  ON campaigns FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- RLS POLICIES: EMAIL TEMPLATES
-- ============================================================================

CREATE POLICY "Users can view their own email templates"
  ON email_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own email templates"
  ON email_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email templates"
  ON email_templates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own email templates"
  ON email_templates FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all email templates"
  ON email_templates FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- RLS POLICIES: LEAD IMPORTS
-- ============================================================================

CREATE POLICY "Users can view their own lead imports"
  ON lead_imports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own lead imports"
  ON lead_imports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all lead imports"
  ON lead_imports FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- RLS POLICIES: LEADS
-- ============================================================================

CREATE POLICY "Users can view their own leads"
  ON leads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own leads"
  ON leads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own leads"
  ON leads FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own leads"
  ON leads FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all leads"
  ON leads FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- RLS POLICIES: EMAIL SENT
-- ============================================================================

CREATE POLICY "Users can view their own email sent"
  ON email_sent FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own email sent"
  ON email_sent FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email sent"
  ON email_sent FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own email sent"
  ON email_sent FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all email sent"
  ON email_sent FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- RLS POLICIES: REPLY IMPORTS
-- ============================================================================

CREATE POLICY "Users can view their own reply imports"
  ON reply_imports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reply imports"
  ON reply_imports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all reply imports"
  ON reply_imports FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- RLS POLICIES: EMAIL REPLIES
-- ============================================================================

CREATE POLICY "Users can view their own email replies"
  ON email_replies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own email replies"
  ON email_replies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email replies"
  ON email_replies FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own email replies"
  ON email_replies FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all email replies"
  ON email_replies FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- RLS POLICIES: MANUS AI QUERIES
-- ============================================================================

CREATE POLICY "Users can view their own manus ai queries"
  ON manus_ai_queries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own manus ai queries"
  ON manus_ai_queries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own manus ai queries"
  ON manus_ai_queries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own manus ai queries"
  ON manus_ai_queries FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all manus ai queries"
  ON manus_ai_queries FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- TRIGGERS: Auto-update updated_at timestamps
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables with updated_at
CREATE TRIGGER update_vibe_plus_connections_updated_at
  BEFORE UPDATE ON vibe_plus_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_sent_updated_at
  BEFORE UPDATE ON email_sent
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_replies_updated_at
  BEFORE UPDATE ON email_replies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TRIGGERS: Update campaign analytics when emails/replies are added
-- ============================================================================

-- Function to update campaign total_leads
CREATE OR REPLACE FUNCTION update_campaign_lead_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.campaign_id IS NOT NULL THEN
    UPDATE campaigns
    SET total_leads = (
      SELECT COUNT(*) FROM leads WHERE campaign_id = NEW.campaign_id
    )
    WHERE id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update campaign lead count
CREATE TRIGGER on_lead_created_update_campaign
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_lead_count();

-- Function to update campaign total_sent (from Vibe Plus synced emails)
CREATE OR REPLACE FUNCTION update_campaign_sent_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.campaign_id IS NOT NULL THEN
    UPDATE campaigns
    SET total_sent = (
      SELECT COUNT(*) FROM email_sent WHERE campaign_id = NEW.campaign_id
    ),
    total_opens = (
      SELECT COUNT(*) FROM email_sent WHERE campaign_id = NEW.campaign_id AND open_count > 0
    ),
    open_rate = (
      SELECT CASE 
        WHEN COUNT(*) > 0 THEN 
          (COUNT(*) FILTER (WHERE open_count > 0)::DECIMAL / COUNT(*)::DECIMAL) * 100
        ELSE 0
      END
      FROM email_sent WHERE campaign_id = NEW.campaign_id
    )
    WHERE id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update campaign sent count
CREATE TRIGGER on_email_sent_update_campaign
  AFTER INSERT OR UPDATE ON email_sent
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_sent_count();

-- Function to update campaign total_replies (from Vibe Plus synced replies)
CREATE OR REPLACE FUNCTION update_campaign_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.campaign_id IS NOT NULL THEN
    UPDATE campaigns
    SET total_replies = (
      SELECT COUNT(*) FROM email_replies WHERE campaign_id = NEW.campaign_id
    ),
    reply_rate = (
      SELECT CASE 
        WHEN c.total_sent > 0 THEN 
          (COUNT(*)::DECIMAL / c.total_sent::DECIMAL) * 100
        ELSE 0
      END
      FROM email_replies er
      CROSS JOIN campaigns c
      WHERE er.campaign_id = NEW.campaign_id AND c.id = NEW.campaign_id
    )
    WHERE id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update campaign reply count
CREATE TRIGGER on_reply_created_update_campaign
  AFTER INSERT ON email_replies
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_reply_count();

COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================
SELECT 'Migration completed successfully! All tables created with RLS and triggers.' as result;
SELECT 'NOTE: All email sending is handled by Vibe Plus. email_sent and email_replies track data synced FROM Vibe Plus.' as note;

