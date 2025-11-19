# Database Design Document

**Last Updated:** 2025-01-17  
**Status:** Design Phase

---

## Overview

This document outlines the database schema for the Superwave platform, focusing on:
- User onboarding and company creation
- Manus AI report storage
- Leads import and management
- Email replies import and tracking
- Email copy/templates storage
- Campaign management

---

## Entity Relationship Overview

```
User (auth.users)
  ├── Company Profile (company_profiles)
  │     ├── Company Report (JSONB in company_profiles.company_report)
  │     └── Project (projects)
  │           ├── Campaign (campaigns)
  │           │     ├── Campaign Leads (leads via campaign_id)
  │           │     ├── Campaign Replies (email_replies via campaign_id)
  │           │     └── Campaign Email Templates (email_templates via campaign_id)
  │           └── Leads (leads via project_id)
  ├── Leads (leads)
  ├── Email Replies (email_replies)
  └── Email Templates (email_templates)
```

---

## Core Tables

### 1. Company Profiles & Projects
**Status:** ✅ Already Created (`create-company-profiles-and-projects.sql`)

- `company_profiles` - Stores company onboarding data and Manus AI reports
- `projects` - Active projects linked to completed company profiles
- `company_profile_files` - Files uploaded during company creation

**Key Fields:**
- `company_profiles.company_report` (JSONB) - Generated report from Manus AI
- `company_profiles.workflow_status` - Tracks Manus workflow progress

---

## New Tables to Create

### 2. Leads Table

**Purpose:** Store leads imported from various sources (Inboxing, Vibe Plus, Manual import)

**Schema:**
```sql
CREATE TABLE leads (
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
  source TEXT NOT NULL, -- 'inboxing', 'vibe_plus', 'manus_ai', 'manual_import'
  source_id TEXT, -- External ID from source system
  source_data JSONB, -- Full data from source system
  
  -- Lead Status
  status TEXT DEFAULT 'new', -- 'new', 'contacted', 'qualified', 'nurture', 'converted', 'lost'
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
  
  -- Additional Data
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  custom_fields JSONB DEFAULT '{}',
  
  -- Import Tracking
  imported_at TIMESTAMP DEFAULT NOW(),
  imported_by UUID REFERENCES auth.users(id),
  import_batch_id UUID REFERENCES lead_imports(id),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_contacted_at TIMESTAMP
);
```

**Indexes:**
- `user_id`, `project_id`, `campaign_id`
- `source`, `status`
- `email` (for deduplication)
- `source_id` + `source` (unique constraint)

---

### 3. Email Replies Table

**Purpose:** Store email replies imported from various sources

**Schema:**
```sql
CREATE TABLE email_replies (
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
  source TEXT NOT NULL, -- 'inboxing', 'vibe_plus', 'manual_import'
  source_id TEXT, -- External ID from source system
  source_data JSONB, -- Full data from source system
  
  -- Reply Analysis
  sentiment TEXT, -- 'positive', 'negative', 'neutral'
  intent TEXT, -- 'interested', 'not_interested', 'request_info', 'meeting_request', etc.
  is_auto_reply BOOLEAN DEFAULT false,
  
  -- Status
  status TEXT DEFAULT 'new', -- 'new', 'read', 'replied', 'archived'
  
  -- Import Tracking
  imported_at TIMESTAMP DEFAULT NOW(),
  imported_by UUID REFERENCES auth.users(id),
  import_batch_id UUID REFERENCES reply_imports(id),
  
  -- Timestamps
  received_at TIMESTAMP NOT NULL, -- When email was received
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
- `user_id`, `project_id`, `campaign_id`, `lead_id`
- `from_email`, `to_email`
- `thread_id`, `message_id`
- `received_at`, `status`
- `source`, `source_id`

---

### 4. Email Templates Table

**Purpose:** Store email copy/templates for campaigns

**Schema:**
```sql
CREATE TABLE email_templates (
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
  template_type TEXT DEFAULT 'outreach', -- 'outreach', 'follow_up', 'reply', 'nurture'
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
```

**Indexes:**
- `user_id`, `project_id`, `campaign_id`
- `template_type`, `is_active`
- `campaign_id` + `sequence_position`

---

### 5. Campaigns Table

**Purpose:** Organize leads, replies, and email templates into campaigns

**Schema:**
```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Campaign Information
  name TEXT NOT NULL,
  description TEXT,
  
  -- Campaign Settings
  status TEXT DEFAULT 'draft', -- 'draft', 'active', 'paused', 'completed', 'archived'
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
```

**Indexes:**
- `user_id`, `project_id`
- `status`, `domain_id`
- `deleted_at` (for soft delete queries)

---

### 6. Lead Imports Table

**Purpose:** Track lead import operations

**Schema:**
```sql
CREATE TABLE lead_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  
  -- Import Details
  source TEXT NOT NULL, -- 'inboxing', 'vibe_plus', 'manus_ai', 'manual_import', 'csv'
  import_type TEXT NOT NULL, -- 'bulk', 'sync', 'manual'
  
  -- Import Statistics
  total_processed INTEGER NOT NULL DEFAULT 0,
  successful INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  
  -- Import Data
  options JSONB, -- Import options/parameters
  errors JSONB, -- Array of error objects
  file_name TEXT, -- If imported from file
  
  -- Status
  status TEXT DEFAULT 'processing', -- 'processing', 'completed', 'failed', 'partial'
  
  -- Timestamps
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_ms INTEGER
);
```

**Indexes:**
- `user_id`, `project_id`, `campaign_id`
- `source`, `status`
- `started_at`

---

### 7. Reply Imports Table

**Purpose:** Track email reply import operations

**Schema:**
```sql
CREATE TABLE reply_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  
  -- Import Details
  source TEXT NOT NULL, -- 'inboxing', 'vibe_plus', 'manual_import'
  import_type TEXT NOT NULL, -- 'bulk', 'sync', 'manual'
  
  -- Import Statistics
  total_processed INTEGER NOT NULL DEFAULT 0,
  successful INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  
  -- Import Data
  options JSONB, -- Import options/parameters
  errors JSONB, -- Array of error objects
  date_range_start TIMESTAMP, -- If importing date range
  date_range_end TIMESTAMP,
  
  -- Status
  status TEXT DEFAULT 'processing', -- 'processing', 'completed', 'failed', 'partial'
  
  -- Timestamps
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_ms INTEGER
);
```

**Indexes:**
- `user_id`, `project_id`, `campaign_id`
- `source`, `status`
- `started_at`

---

## Relationships Summary

### User → Company Profile → Project
- User creates company profile
- Manus AI generates report (stored in `company_profiles.company_report`)
- When workflow completes, project is auto-created

### Project → Campaign
- Projects can have multiple campaigns
- Campaigns organize outreach efforts

### Campaign → Leads
- Leads can be associated with campaigns
- Leads can also exist at project level (not campaign-specific)

### Campaign → Email Replies
- Replies linked to campaigns for tracking
- Replies can also link to specific leads

### Campaign → Email Templates
- Templates can be campaign-specific or project-level
- Templates define email copy for outreach

### Import Tracking
- `lead_imports` tracks bulk lead imports
- `reply_imports` tracks bulk reply imports
- Both link to projects/campaigns for organization

---

## Row Level Security (RLS) Strategy

All tables should have RLS enabled with policies:
1. Users can only access their own data (via `user_id`)
2. Service role can access all data (for API operations)
3. Admins can access all data (for support/debugging)

---

## Next Steps

1. ✅ Review and approve this design
2. Create SQL migration files for each table
3. Add RLS policies
4. Create indexes for performance
5. Add triggers for `updated_at` timestamps
6. Create API routes for CRUD operations
7. Build import functionality for leads and replies

---

## Notes

- **Manus Reports**: Stored as JSONB in `company_profiles.company_report` - flexible structure for varying report formats
- **Deduplication**: Leads should be deduplicated by `email` + `source` or `source_id` + `source`
- **Soft Deletes**: Campaigns use soft deletes (`deleted_at`), other tables use hard deletes
- **Import History**: Use `lead_imports` and `reply_imports` for audit trail
- **Email Threading**: `email_replies.thread_id` enables conversation threading
- **Template Variables**: Store available variables in `email_templates.variables` JSONB field

