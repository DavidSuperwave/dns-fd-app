# Complete Database Schema Map

**Last Updated:** 2025-01-17  
**Status:** Complete Database Design

---

## Overview

This document provides a complete mapping of all database tables in the Superwave platform, including existing tables and new tables needed for the full feature set.

---

## Table Categories

1. **Authentication & Users**
2. **Company & Projects**
3. **Domains & Infrastructure**
4. **Campaigns & Outreach**
5. **Leads & Contacts**
6. **Email Management**
7. **Integrations**
8. **Billing & Subscriptions**
9. **System & Tracking**

---

## 1. Authentication & Users

### `auth.users` (Supabase Auth)
**Status:** ✅ Existing (Supabase managed)

- Standard Supabase authentication table
- Contains user authentication data

### `user_profiles`
**Status:** ✅ Existing (`create-user-profiles.sql`)

```sql
- id UUID (PK, FK → auth.users)
- email TEXT UNIQUE NOT NULL
- name TEXT
- role TEXT ('admin', 'user', 'guest')
- active BOOLEAN DEFAULT true
- status TEXT ('pending', 'active', 'inactive')
- has_2fa BOOLEAN DEFAULT false
- created_at TIMESTAMP
```

**Relationships:**
- One-to-one with `auth.users`
- One-to-many with all user-owned tables

### `invitations`
**Status:** ✅ Existing (`create-invitations-table.sql`)

```sql
- id UUID (PK)
- email TEXT NOT NULL
- role TEXT DEFAULT 'user'
- token TEXT UNIQUE NOT NULL
- created_by TEXT
- status TEXT DEFAULT 'pending'
- created_at TIMESTAMP
- expires_at TIMESTAMP
- used_at TIMESTAMP
```

### `pending_users`
**Status:** ✅ Existing (`create-pending-users-table.sql`)

```sql
- id UUID (PK)
- email TEXT UNIQUE NOT NULL
- role TEXT
- invited_by TEXT
- invitation_id UUID (FK → invitations)
- created_at TIMESTAMP
```

---

## 2. Company & Projects

### `company_profiles`
**Status:** ✅ Existing (`create-company-profiles-and-projects.sql`)

```sql
- id UUID (PK)
- user_id UUID (FK → auth.users)
- client_name TEXT NOT NULL
- industry TEXT NOT NULL
- offer_service TEXT NOT NULL
- pricing TEXT NOT NULL
- target_market TEXT NOT NULL
- goals TEXT NOT NULL
- workflow_status TEXT DEFAULT 'pending'
- manus_workflow_id TEXT
- company_report JSONB  -- Manus AI generated report
- competitors_data JSONB
- logo_url TEXT
- created_at TIMESTAMP
- updated_at TIMESTAMP
- completed_at TIMESTAMP
```

**Key Features:**
- Stores Manus AI generated reports in `company_report` JSONB field
- Workflow status tracks: pending → generating → creating_report → validating_report → finding_competitors → completed

### `company_profile_files`
**Status:** ✅ Existing (`create-company-profiles-and-projects.sql`)

```sql
- id UUID (PK)
- company_profile_id UUID (FK → company_profiles)
- file_name TEXT NOT NULL
- file_path TEXT NOT NULL
- file_size BIGINT
- file_type TEXT
- uploaded_at TIMESTAMP
```

### `projects`
**Status:** ✅ Existing (`create-company-profiles-and-projects.sql`)

```sql
- id UUID (PK)
- user_id UUID (FK → auth.users)
- company_profile_id UUID (FK → company_profiles)
- name TEXT NOT NULL
- status TEXT DEFAULT 'active' ('active', 'paused', 'completed', 'deleted')
- logo_url TEXT
- description TEXT
- created_at TIMESTAMP
- updated_at TIMESTAMP
- deleted_at TIMESTAMP  -- Soft delete
```

**Auto-creation:** Trigger creates project when `company_profiles.workflow_status = 'completed'`

---

## 3. Domains & Infrastructure

### `domains`
**Status:** ✅ Existing

```sql
- id SERIAL (PK)
- cloudflare_id TEXT UNIQUE NOT NULL
- name TEXT NOT NULL
- status TEXT
- paused BOOLEAN DEFAULT FALSE
- type TEXT
- created_on TIMESTAMP
- modified_on TIMESTAMP
- last_synced TIMESTAMP DEFAULT NOW()
- user_id UUID (FK → auth.users, nullable)
- redirect_url TEXT
- redirect_url_last_updated TIMESTAMP
- deployment_status TEXT
- has_files BOOLEAN
```

**Source:** Synced from Cloudflare API

### `domain_assignments`
**Status:** ✅ Existing

```sql
- id UUID (PK)
- domain_id INTEGER (FK → domains)
- user_email TEXT NOT NULL
- user_id UUID (FK → auth.users, nullable)
- assigned_at TIMESTAMP DEFAULT NOW()
- created_by TEXT
```

**Purpose:** Links domains to users (many-to-many relationship)

---

## 4. Campaigns & Outreach

### `campaigns`
**Status:** ⚠️ Needs Update (add Vibe Plus sync fields)

```sql
- id UUID (PK)
- user_id UUID (FK → auth.users)
- project_id UUID (FK → projects)
- name TEXT NOT NULL
- description TEXT
  
  -- Vibe Plus Integration
- vibe_plus_campaign_id TEXT  -- External campaign ID from Vibe Plus
- vibe_plus_campaign_name TEXT  -- Campaign name from Vibe Plus (for syncing)
- sync_with_vibe_plus BOOLEAN DEFAULT false
- last_vibe_plus_sync TIMESTAMP
  
  -- Campaign Settings
- status TEXT DEFAULT 'draft' ('draft', 'active', 'paused', 'completed', 'archived')
- start_date TIMESTAMP
- end_date TIMESTAMP
  
  -- Email Settings
- from_email TEXT
- from_name TEXT
- reply_to_email TEXT
  
  -- Domain Assignment
- domain_id INTEGER (FK → domains)
- inboxing_job_id INTEGER
  
  -- Analytics (calculated from email_sent and email_replies)
- total_leads INTEGER DEFAULT 0
- total_sent INTEGER DEFAULT 0
- total_replies INTEGER DEFAULT 0
- total_opens INTEGER DEFAULT 0
- open_rate DECIMAL(5,2)
- reply_rate DECIMAL(5,2)
  
  -- Timestamps
- created_at TIMESTAMP DEFAULT NOW()
- updated_at TIMESTAMP DEFAULT NOW()
- deleted_at TIMESTAMP  -- Soft delete
```

**Key Features:**
- Can sync with Vibe Plus campaigns via `vibe_plus_campaign_id`
- Campaign name can be synced from Vibe Plus
- Analytics calculated from `email_sent` and `email_replies` tables

---

## 5. Leads & Contacts

### `leads`
**Status:** 🆕 New (to be created)

```sql
- id UUID (PK)
- user_id UUID (FK → auth.users)
- project_id UUID (FK → projects, nullable)
- campaign_id UUID (FK → campaigns, nullable)
  
  -- Lead Information
- name TEXT NOT NULL
- email TEXT
- company TEXT
- title TEXT
- phone TEXT
- website TEXT
  
  -- Source Tracking
- source TEXT NOT NULL ('inboxing', 'vibe_plus', 'manus_ai', 'manual_import', 'csv', 'platform_upload')
- source_id TEXT  -- External ID from source system
- source_data JSONB DEFAULT '{}'  -- Full data from source
  
  -- Lead Status
- status TEXT DEFAULT 'new' ('new', 'contacted', 'qualified', 'nurture', 'converted', 'lost')
- priority TEXT DEFAULT 'medium' ('low', 'medium', 'high')
  
  -- Additional Data
- tags TEXT[] DEFAULT '{}'
- notes TEXT
- custom_fields JSONB DEFAULT '{}'
  
  -- Import Tracking
- imported_at TIMESTAMP DEFAULT NOW()
- imported_by UUID (FK → auth.users)
- import_batch_id UUID (FK → lead_imports)
  
  -- Timestamps
- created_at TIMESTAMP DEFAULT NOW()
- updated_at TIMESTAMP DEFAULT NOW()
- last_contacted_at TIMESTAMP
  
  -- Constraints
- UNIQUE(source, source_id)  -- Prevent duplicates from same source
```

**Key Features:**
- Supports multiple sources including platform uploads
- Links to projects and campaigns
- Tracks import history

### `lead_imports`
**Status:** 🆕 New (to be created)

```sql
- id UUID (PK)
- user_id UUID (FK → auth.users)
- project_id UUID (FK → projects, nullable)
- campaign_id UUID (FK → campaigns, nullable)
  
  -- Import Details
- source TEXT NOT NULL ('inboxing', 'vibe_plus', 'manus_ai', 'manual_import', 'csv', 'platform_upload')
- import_type TEXT NOT NULL ('bulk', 'sync', 'manual')
  
  -- Import Statistics
- total_processed INTEGER DEFAULT 0
- successful INTEGER DEFAULT 0
- skipped INTEGER DEFAULT 0
- failed INTEGER DEFAULT 0
  
  -- Import Data
- options JSONB DEFAULT '{}'
- errors JSONB DEFAULT '[]'
- file_name TEXT
  
  -- Status
- status TEXT DEFAULT 'processing' ('processing', 'completed', 'failed', 'partial')
  
  -- Timestamps
- started_at TIMESTAMP DEFAULT NOW()
- completed_at TIMESTAMP
- duration_ms INTEGER
```

---

## 6. Email Management

### `email_sent`
**Status:** 🆕 New (to be created) - **IMPORTANT: Track sent emails separately**

```sql
- id UUID (PK)
- user_id UUID (FK → auth.users)
- project_id UUID (FK → projects, nullable)
- campaign_id UUID (FK → campaigns, nullable)
- lead_id UUID (FK → leads, nullable)
- email_template_id UUID (FK → email_templates, nullable)
  
  -- Email Information
- from_email TEXT NOT NULL
- from_name TEXT
- to_email TEXT NOT NULL
- to_name TEXT
- subject TEXT NOT NULL
- body_text TEXT
- body_html TEXT
  
  -- Tracking
- message_id TEXT UNIQUE  -- Unique email message ID
- thread_id TEXT  -- Email thread/conversation ID
  
  -- Source Tracking
- source TEXT NOT NULL ('platform', 'vibe_plus', 'inboxing', 'manual')
- source_id TEXT  -- External ID from source system
- source_data JSONB DEFAULT '{}'
  
  -- Email Status
- status TEXT DEFAULT 'sent' ('sent', 'delivered', 'bounced', 'failed')
- opened_at TIMESTAMP  -- First open time
- open_count INTEGER DEFAULT 0
- clicked_at TIMESTAMP  -- First click time
- click_count INTEGER DEFAULT 0
  
  -- Vibe Plus Integration
- vibe_plus_email_id TEXT  -- If synced from Vibe Plus
- vibe_plus_campaign_id TEXT  -- Campaign ID from Vibe Plus
  
  -- Timestamps
- sent_at TIMESTAMP NOT NULL
- created_at TIMESTAMP DEFAULT NOW()
- updated_at TIMESTAMP DEFAULT NOW()
```

**Key Features:**
- Tracks all sent emails (not just replies)
- Links to leads, campaigns, and templates
- Tracks opens and clicks
- Can sync from Vibe Plus

### `email_replies`
**Status:** 🆕 New (to be created)

```sql
- id UUID (PK)
- user_id UUID (FK → auth.users)
- project_id UUID (FK → projects, nullable)
- campaign_id UUID (FK → campaigns, nullable)
- lead_id UUID (FK → leads, nullable)
- email_sent_id UUID (FK → email_sent, nullable)  -- Reply to which sent email
  
  -- Email Information
- from_email TEXT NOT NULL
- from_name TEXT
- to_email TEXT NOT NULL
- to_name TEXT
- subject TEXT NOT NULL
- body_text TEXT
- body_html TEXT
  
  -- Thread Tracking
- thread_id TEXT
- in_reply_to TEXT  -- Message ID this is replying to
- message_id TEXT UNIQUE
  
  -- Source Tracking
- source TEXT NOT NULL ('inboxing', 'vibe_plus', 'manual_import', 'platform')
- source_id TEXT
- source_data JSONB DEFAULT '{}'
  
  -- Reply Analysis
- sentiment TEXT ('positive', 'negative', 'neutral')
- intent TEXT  -- 'interested', 'not_interested', 'request_info', 'meeting_request', etc.
- is_auto_reply BOOLEAN DEFAULT false
  
  -- Status
- status TEXT DEFAULT 'new' ('new', 'read', 'replied', 'archived')
  
  -- Vibe Plus Integration
- vibe_plus_reply_id TEXT  -- If synced from Vibe Plus
- vibe_plus_campaign_id TEXT  -- Campaign ID from Vibe Plus
  
  -- Import Tracking
- imported_at TIMESTAMP DEFAULT NOW()
- imported_by UUID (FK → auth.users)
- import_batch_id UUID (FK → reply_imports)
  
  -- Timestamps
- received_at TIMESTAMP NOT NULL
- created_at TIMESTAMP DEFAULT NOW()
- updated_at TIMESTAMP DEFAULT NOW()
```

**Key Features:**
- Links to `email_sent` to track which email was replied to
- Can sync from Vibe Plus
- Supports sentiment and intent analysis

### `email_templates`
**Status:** 🆕 New (to be created)

```sql
- id UUID (PK)
- user_id UUID (FK → auth.users)
- project_id UUID (FK → projects, nullable)
- campaign_id UUID (FK → campaigns, nullable)
  
  -- Template Information
- name TEXT NOT NULL
- description TEXT
- subject TEXT NOT NULL
- body_text TEXT NOT NULL
- body_html TEXT
  
  -- Template Type
- template_type TEXT DEFAULT 'outreach' ('outreach', 'follow_up', 'reply', 'nurture')
- sequence_position INTEGER  -- For multi-step sequences
  
  -- Personalization Variables
- variables JSONB DEFAULT '{}'  -- Available variables: {{firstName}}, {{company}}, etc.
  
  -- Usage Tracking
- usage_count INTEGER DEFAULT 0
- last_used_at TIMESTAMP
  
  -- Status
- is_active BOOLEAN DEFAULT true
- is_default BOOLEAN DEFAULT false
  
  -- Timestamps
- created_at TIMESTAMP DEFAULT NOW()
- updated_at TIMESTAMP DEFAULT NOW()
```

### `reply_imports`
**Status:** 🆕 New (to be created)

```sql
- id UUID (PK)
- user_id UUID (FK → auth.users)
- project_id UUID (FK → projects, nullable)
- campaign_id UUID (FK → campaigns, nullable)
  
  -- Import Details
- source TEXT NOT NULL ('inboxing', 'vibe_plus', 'manual_import')
- import_type TEXT NOT NULL ('bulk', 'sync', 'manual')
  
  -- Import Statistics
- total_processed INTEGER DEFAULT 0
- successful INTEGER DEFAULT 0
- skipped INTEGER DEFAULT 0
- failed INTEGER DEFAULT 0
  
  -- Import Data
- options JSONB DEFAULT '{}'
- errors JSONB DEFAULT '[]'
- date_range_start TIMESTAMP
- date_range_end TIMESTAMP
  
  -- Status
- status TEXT DEFAULT 'processing' ('processing', 'completed', 'failed', 'partial')
  
  -- Timestamps
- started_at TIMESTAMP DEFAULT NOW()
- completed_at TIMESTAMP
- duration_ms INTEGER
```

---

## 7. Integrations

### `vibe_plus_connections`
**Status:** 🆕 New (to be created)

```sql
- id UUID (PK)
- user_id UUID (FK → auth.users)
  
  -- API Credentials
- api_key TEXT NOT NULL
- api_secret TEXT
- connection_name TEXT
  
  -- Status
- is_active BOOLEAN DEFAULT true
- last_sync_at TIMESTAMP
- last_sync_status TEXT  -- 'success', 'failed', 'partial'
- last_sync_error TEXT
  
  -- Timestamps
- created_at TIMESTAMP DEFAULT NOW()
- updated_at TIMESTAMP DEFAULT NOW()
```

**Purpose:** Store Vibe Plus API credentials per user

### `vibe_plus_sync_history`
**Status:** 🆕 New (to be created)

```sql
- id UUID (PK)
- user_id UUID (FK → auth.users)
- connection_id UUID (FK → vibe_plus_connections)
  
  -- Sync Details
- sync_type TEXT NOT NULL ('campaigns', 'emails_sent', 'replies', 'full')
- date_range_start TIMESTAMP
- date_range_end TIMESTAMP
  
  -- Sync Statistics
- campaigns_synced INTEGER DEFAULT 0
- emails_sent_synced INTEGER DEFAULT 0
- replies_synced INTEGER DEFAULT 0
- leads_synced INTEGER DEFAULT 0
  
  -- Status
- status TEXT DEFAULT 'processing' ('processing', 'completed', 'failed', 'partial')
- error_message TEXT
  
  -- Timestamps
- started_at TIMESTAMP DEFAULT NOW()
- completed_at TIMESTAMP
- duration_ms INTEGER
```

**Purpose:** Track Vibe Plus sync operations

### `manus_ai_queries`
**Status:** 🆕 New (to be created, from REBUILD_PLAN.md)

```sql
- id UUID (PK)
- user_id UUID (FK → auth.users)
- campaign_id UUID (FK → campaigns, nullable)
- project_id UUID (FK → projects, nullable)
  
  -- Query Information
- query_text TEXT NOT NULL
- query_type TEXT
- result_data JSONB
- status TEXT ('pending', 'processing', 'completed', 'failed')
  
  -- Timestamps
- created_at TIMESTAMP DEFAULT NOW()
- completed_at TIMESTAMP
```

---

## 8. Billing & Subscriptions

### `billing_plan_templates`
**Status:** ✅ Existing (`create-billing-system-schema.sql`)

```sql
- id UUID (PK)
- name TEXT UNIQUE NOT NULL
- description TEXT
- included_domain_slots INTEGER DEFAULT 0
- base_price DECIMAL(10,2) NOT NULL
- price_per_additional_slot DECIMAL(10,2) DEFAULT 0.00
- max_domain_slots INTEGER
- billing_cycle TEXT DEFAULT 'monthly'
- is_custom BOOLEAN DEFAULT FALSE
- is_active BOOLEAN DEFAULT TRUE
- whop_plan_id TEXT
- stripe_price_id TEXT
- created_by UUID (FK → auth.users)
- created_at TIMESTAMP
- updated_at TIMESTAMP
```

### `billing_plans`
**Status:** ✅ Existing (`create-billing-system-schema.sql`)

```sql
- id UUID (PK)
- user_id UUID (FK → auth.users)
- company_id UUID (FK → companies, nullable)  -- ⚠️ May need to remove if companies table is removed
- plan_template_id UUID (FK → billing_plan_templates)
- domain_slots_total INTEGER DEFAULT 5
- domain_slots_used INTEGER DEFAULT 0
- domain_slots_available INTEGER (computed)
- custom_base_price DECIMAL(10,2)
- custom_price_per_slot DECIMAL(10,2)
- custom_domain_limit INTEGER
- custom_billing_cycle TEXT
- effective_base_price DECIMAL(10,2)
- effective_price_per_slot DECIMAL(10,2)
- effective_domain_limit INTEGER
- payment_provider TEXT DEFAULT 'manual'
- external_customer_id TEXT
- external_subscription_id TEXT
- external_plan_id TEXT
- status TEXT DEFAULT 'active'
- current_period_start TIMESTAMP
- current_period_end TIMESTAMP
- trial_ends_at TIMESTAMP
- next_billing_amount DECIMAL(10,2)
- last_payment_date TIMESTAMP
- provider_metadata JSONB DEFAULT '{}'
- admin_notes TEXT
- created_by UUID (FK → auth.users)
- created_at TIMESTAMP
- updated_at TIMESTAMP
```

### `domain_slot_transactions`
**Status:** ✅ Existing (`create-billing-system-schema.sql`)

```sql
- id UUID (PK)
- billing_plan_id UUID (FK → billing_plans)
- transaction_type TEXT NOT NULL
- slots_before INTEGER
- slots_after INTEGER
- slots_changed INTEGER
- amount DECIMAL(10,2)
- currency TEXT DEFAULT 'usd'
- reason TEXT
- domain_id INTEGER (FK → domains)
- external_transaction_id TEXT
- payment_provider TEXT
- created_by UUID (FK → auth.users)
- created_at TIMESTAMP
```

### `billing_history`
**Status:** ✅ Existing (`create-billing-system-schema.sql`)

```sql
- id UUID (PK)
- billing_plan_id UUID (FK → billing_plans)
- amount DECIMAL(10,2) NOT NULL
- currency TEXT DEFAULT 'usd'
- payment_status TEXT NOT NULL
- payment_method TEXT
- payment_provider TEXT NOT NULL
- external_transaction_id TEXT
- external_invoice_id TEXT
- external_receipt_url TEXT
- period_start TIMESTAMP
- period_end TIMESTAMP
- description TEXT
- provider_response JSONB DEFAULT '{}'
- created_at TIMESTAMP
```

### `pricing_history`
**Status:** ✅ Existing (`create-billing-system-schema.sql`)

```sql
- id UUID (PK)
- billing_plan_id UUID (FK → billing_plans)
- change_type TEXT NOT NULL
- old_base_price DECIMAL(10,2)
- new_base_price DECIMAL(10,2)
- old_price_per_slot DECIMAL(10,2)
- new_price_per_slot DECIMAL(10,2)
- old_domain_slots INTEGER
- new_domain_slots INTEGER
- old_plan_template_id UUID
- new_plan_template_id UUID
- reason TEXT
- external_reference TEXT
- changed_by UUID (FK → auth.users)
- effective_date TIMESTAMP
- created_at TIMESTAMP
```

---

## 9. System & Tracking

### `import_history`
**Status:** ✅ Existing (`create-import-history-table.sql`)

```sql
- id UUID (PK)
- timestamp TIMESTAMP DEFAULT NOW()
- type TEXT NOT NULL DEFAULT 'bulk_cloudflare_import'
- total_processed INTEGER DEFAULT 0
- successful INTEGER DEFAULT 0
- skipped INTEGER DEFAULT 0
- failed INTEGER DEFAULT 0
- options JSONB
- errors JSONB
- duration_ms INTEGER
- initiated_by UUID (FK → auth.users)
- created_at TIMESTAMP
```

### `tasks`
**Status:** ✅ Existing (`create-tasks-table.sql`)

```sql
- id UUID (PK)
- user_id TEXT NOT NULL
- user_account TEXT
- user_email TEXT
- task_type TEXT NOT NULL
- description TEXT
- priority TEXT DEFAULT 'Medium'
- status TEXT DEFAULT 'Open'
- due_date DATE
- assigned_to TEXT DEFAULT 'unassigned'
- tags TEXT[] DEFAULT '{}'
- created_at TIMESTAMP
- updated_at TIMESTAMP
```

---

## Complete Entity Relationship Diagram

```
auth.users
  ├── user_profiles (1:1)
  ├── company_profiles (1:many)
  │     ├── company_profile_files (1:many)
  │     └── projects (1:many, auto-created on completion)
  │           ├── campaigns (1:many)
  │           │     ├── leads (many, via campaign_id)
  │           │     ├── email_sent (many, via campaign_id)
  │           │     ├── email_replies (many, via campaign_id)
  │           │     └── email_templates (many, via campaign_id)
  │           ├── leads (many, via project_id)
  │           └── email_templates (many, via project_id)
  ├── domains (many, via user_id or domain_assignments)
  ├── leads (many, direct)
  ├── email_sent (many)
  ├── email_replies (many)
  ├── email_templates (many)
  ├── campaigns (many)
  ├── vibe_plus_connections (many)
  ├── billing_plans (many)
  └── manus_ai_queries (many)

domains
  ├── domain_assignments (1:many)
  ├── campaigns (many, via domain_id)
  └── domain_slot_transactions (many, via domain_id)

campaigns
  ├── leads (many)
  ├── email_sent (many)
  ├── email_replies (many)
  ├── email_templates (many)
  └── vibe_plus_sync_history (many, via connection)

leads
  ├── email_sent (many, via lead_id)
  └── email_replies (many, via lead_id)

email_sent
  └── email_replies (many, via email_sent_id)

vibe_plus_connections
  └── vibe_plus_sync_history (1:many)
```

---

## Key Design Decisions

### 1. Email Sent vs Replies
- **`email_sent`** - Tracks all outgoing emails (from platform, Vibe Plus, etc.)
- **`email_replies`** - Tracks incoming replies
- **Relationship:** `email_replies.email_sent_id` links reply to original sent email

### 2. Vibe Plus Integration
- Campaigns can sync with Vibe Plus via `vibe_plus_campaign_id`
- Emails sent from Vibe Plus stored in `email_sent` with `source = 'vibe_plus'`
- Replies from Vibe Plus stored in `email_replies` with `source = 'vibe_plus'`
- Campaign names synced via `vibe_plus_campaign_name`

### 3. Lead Sources
- Supports: `inboxing`, `vibe_plus`, `manus_ai`, `manual_import`, `csv`, `platform_upload`
- Platform uploads stored with `source = 'platform_upload'`

### 4. Campaign Analytics
- Calculated from `email_sent` and `email_replies` tables
- `total_sent` = COUNT(email_sent WHERE campaign_id = X)
- `total_replies` = COUNT(email_replies WHERE campaign_id = X)
- `open_rate` = (COUNT opened emails / total_sent) * 100
- `reply_rate` = (total_replies / total_sent) * 100

---

## Migration Order

1. ✅ Existing tables (already created)
2. 🆕 `vibe_plus_connections`
3. 🆕 `vibe_plus_sync_history`
4. 🆕 `campaigns` (with Vibe Plus fields)
5. 🆕 `email_templates`
6. 🆕 `leads`
7. 🆕 `lead_imports`
8. 🆕 `email_sent` (IMPORTANT: before email_replies)
9. 🆕 `email_replies` (references email_sent)
10. 🆕 `reply_imports`
11. 🆕 `manus_ai_queries`

---

## Next Steps

1. Create updated migration SQL file with all new tables
2. Add Vibe Plus sync functionality
3. Build API routes for email_sent and email_replies
4. Create import functions for Vibe Plus data
5. Update campaign analytics to use email_sent/replies data

