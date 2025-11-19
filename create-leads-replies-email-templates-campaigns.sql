-- ============================================================================
-- Database Migration: Leads, Replies, Email Templates, and Campaigns
-- ============================================================================
-- This migration creates the core tables for:
-- 1. Campaigns (organize outreach efforts)
-- 2. Leads (imported from various sources)
-- 3. Email Replies (imported replies)
-- 4. Email Templates (email copy storage)
-- 5. Lead Imports (track lead import operations)
-- 6. Reply Imports (track reply import operations)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CAMPAIGNS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Campaign Information
  name TEXT NOT NULL,
  description TEXT,
  
  -- Campaign Settings
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  
  -- Email Settings
  from_email TEXT,
  from_name TEXT,
  reply_to_email TEXT,
  
  -- Domain Assignment
  domain_id INTEGER REFERENCES domains(id) ON DELETE SET NULL,
  inboxing_job_id INTEGER, -- Inboxing deployment job ID
  
  -- Analytics
  total_leads INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
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
CREATE INDEX IF NOT EXISTS idx_campaigns_deleted_at ON campaigns(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- 2. LEADS TABLE
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
  source TEXT NOT NULL CHECK (source IN ('inboxing', 'vibe_plus', 'manus_ai', 'manual_import', 'csv')),
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
  import_batch_id UUID, -- Will reference lead_imports(id) after table creation
  
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
-- 3. EMAIL REPLIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  
  -- Email Information
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
  
  -- Source Tracking
  source TEXT NOT NULL CHECK (source IN ('inboxing', 'vibe_plus', 'manual_import')),
  source_id TEXT, -- External ID from source system
  source_data JSONB DEFAULT '{}', -- Full data from source system
  
  -- Reply Analysis
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  intent TEXT, -- 'interested', 'not_interested', 'request_info', 'meeting_request', etc.
  is_auto_reply BOOLEAN DEFAULT false,
  
  -- Status
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived')),
  
  -- Import Tracking
  imported_at TIMESTAMP DEFAULT NOW(),
  imported_by UUID REFERENCES auth.users(id),
  import_batch_id UUID, -- Will reference reply_imports(id) after table creation
  
  -- Timestamps
  received_at TIMESTAMP NOT NULL, -- When email was received
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for email_replies
CREATE INDEX IF NOT EXISTS idx_email_replies_user_id ON email_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_project_id ON email_replies(project_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_campaign_id ON email_replies(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_lead_id ON email_replies(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_from_email ON email_replies(from_email);
CREATE INDEX IF NOT EXISTS idx_email_replies_to_email ON email_replies(to_email);
CREATE INDEX IF NOT EXISTS idx_email_replies_thread_id ON email_replies(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_replies_message_id ON email_replies(message_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_received_at ON email_replies(received_at);
CREATE INDEX IF NOT EXISTS idx_email_replies_status ON email_replies(status);
CREATE INDEX IF NOT EXISTS idx_email_replies_source ON email_replies(source);
CREATE INDEX IF NOT EXISTS idx_email_replies_import_batch_id ON email_replies(import_batch_id);

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
-- 5. LEAD IMPORTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS lead_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  
  -- Import Details
  source TEXT NOT NULL CHECK (source IN ('inboxing', 'vibe_plus', 'manus_ai', 'manual_import', 'csv')),
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

-- Now add foreign key constraint for leads.import_batch_id
ALTER TABLE leads 
  ADD CONSTRAINT fk_leads_import_batch_id 
  FOREIGN KEY (import_batch_id) 
  REFERENCES lead_imports(id) 
  ON DELETE SET NULL;

-- ============================================================================
-- 6. REPLY IMPORTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS reply_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  
  -- Import Details
  source TEXT NOT NULL CHECK (source IN ('inboxing', 'vibe_plus', 'manual_import')),
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

-- Now add foreign key constraint for email_replies.import_batch_id
ALTER TABLE email_replies 
  ADD CONSTRAINT fk_email_replies_import_batch_id 
  FOREIGN KEY (import_batch_id) 
  REFERENCES reply_imports(id) 
  ON DELETE SET NULL;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_imports ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: CAMPAIGNS
-- ============================================================================

-- Users can view their own campaigns
CREATE POLICY "Users can view their own campaigns"
  ON campaigns FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own campaigns
CREATE POLICY "Users can create their own campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own campaigns
CREATE POLICY "Users can update their own campaigns"
  ON campaigns FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own campaigns (soft delete)
CREATE POLICY "Users can delete their own campaigns"
  ON campaigns FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can manage all campaigns
CREATE POLICY "Service role can manage all campaigns"
  ON campaigns FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- RLS POLICIES: LEADS
-- ============================================================================

-- Users can view their own leads
CREATE POLICY "Users can view their own leads"
  ON leads FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own leads
CREATE POLICY "Users can create their own leads"
  ON leads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own leads
CREATE POLICY "Users can update their own leads"
  ON leads FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own leads
CREATE POLICY "Users can delete their own leads"
  ON leads FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can manage all leads
CREATE POLICY "Service role can manage all leads"
  ON leads FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- RLS POLICIES: EMAIL REPLIES
-- ============================================================================

-- Users can view their own email replies
CREATE POLICY "Users can view their own email replies"
  ON email_replies FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own email replies
CREATE POLICY "Users can create their own email replies"
  ON email_replies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own email replies
CREATE POLICY "Users can update their own email replies"
  ON email_replies FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own email replies
CREATE POLICY "Users can delete their own email replies"
  ON email_replies FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can manage all email replies
CREATE POLICY "Service role can manage all email replies"
  ON email_replies FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- RLS POLICIES: EMAIL TEMPLATES
-- ============================================================================

-- Users can view their own email templates
CREATE POLICY "Users can view their own email templates"
  ON email_templates FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own email templates
CREATE POLICY "Users can create their own email templates"
  ON email_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own email templates
CREATE POLICY "Users can update their own email templates"
  ON email_templates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own email templates
CREATE POLICY "Users can delete their own email templates"
  ON email_templates FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can manage all email templates
CREATE POLICY "Service role can manage all email templates"
  ON email_templates FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- RLS POLICIES: LEAD IMPORTS
-- ============================================================================

-- Users can view their own lead imports
CREATE POLICY "Users can view their own lead imports"
  ON lead_imports FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own lead imports
CREATE POLICY "Users can create their own lead imports"
  ON lead_imports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can manage all lead imports
CREATE POLICY "Service role can manage all lead imports"
  ON lead_imports FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- RLS POLICIES: REPLY IMPORTS
-- ============================================================================

-- Users can view their own reply imports
CREATE POLICY "Users can view their own reply imports"
  ON reply_imports FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own reply imports
CREATE POLICY "Users can create their own reply imports"
  ON reply_imports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can manage all reply imports
CREATE POLICY "Service role can manage all reply imports"
  ON reply_imports FOR ALL
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
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
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
-- TRIGGERS: Update campaign analytics when leads/replies are added
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

-- Function to update campaign total_replies
CREATE OR REPLACE FUNCTION update_campaign_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.campaign_id IS NOT NULL THEN
    UPDATE campaigns
    SET total_replies = (
      SELECT COUNT(*) FROM email_replies WHERE campaign_id = NEW.campaign_id
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
SELECT 'Migration completed successfully! Tables created: campaigns, leads, email_replies, email_templates, lead_imports, reply_imports' as result;

