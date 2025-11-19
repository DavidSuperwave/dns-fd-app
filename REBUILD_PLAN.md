# Superwave Platform Rebuild Plan

**Last Updated:** 2025-01-17  
**Status:** Database Foundation Complete - Ready for Feature Development

---

## 🎯 Goals

1. **Integrate Inboxing API** for infrastructure management (keep, refactor)
2. **Build Campaign Dashboard** with campaign setup features
3. **Connect Vibe Plus API** for additional data
4. **Integrate Manus AI** for query execution
5. **Rebuild navigation** around Overview, Infrastructure, Leads, Projects tabs
6. **Remove unused features** (tenants, cron monitor, test pages)
7. **Streamline codebase** for faster development

---

## 🧭 Navigation & Tabs

Primary tabs to support the new workflow:

| Tab | Purpose | Notes |
| --- | --- | --- |
| **Overview** | Default landing page with KPIs and quick actions | `/overview` |
| **Infrastructure** | Former “Domains” tab for managing DNS/Cloudflare | `/infrastructure` (aliases `/domains`) |
| **Leads** | View leads across integrations (Inboxing, Vibe Plus, Manus AI) | `/leads` |
| **Projects** | Organize campaigns/projects with All/Deleted dropdown | `/projects` (dropdown in page) |
| **Billing / Settings** | Existing management tabs (unchanged) | `/billing`, `/settings` |

---

## 📋 Phase 1: Cleanup & Database Review

### Database Tables to REMOVE

#### ❌ Remove Completely
- `tenants`
- `tenant_user_roles`
- `chat_channels`, `chat_messages`, `chat_dm_threads`, `chat_dm_participants`
- `companies`, `user_company_memberships`, `company_domains`

#### ⚠️ Review & Possibly Remove
- `scan_results`, `scan_progress`, `sync_history` (keep if needed for health checks)

#### ✅ KEEP (Core Tables)
- `domains`, `domain_assignments`, `user_profiles`
- `billing_plan_templates`, `billing_plans`
- `domain_slot_transactions`, `billing_history`, `pricing_history`
- `invitations`, `pending_users`

### Database Tables to ADD (Future)

#### Campaign System
```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE campaign_domains (
  id UUID PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id),
  domain_id INTEGER REFERENCES domains(id),
  inboxing_job_id INTEGER,
  deployment_status TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE campaign_analytics (
  id UUID PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id),
  metric_name TEXT,
  metric_value JSONB,
  recorded_at TIMESTAMP DEFAULT NOW()
);
```

#### Integration Tables
```sql
CREATE TABLE vibe_plus_connections (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  api_key TEXT NOT NULL,
  api_secret TEXT,
  connection_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE manus_ai_queries (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  campaign_id UUID REFERENCES campaigns(id),
  query_text TEXT NOT NULL,
  query_type TEXT,
  result_data JSONB,
  status TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

#### Company Profile System
**Workflow:** User submits form → start(workflow) ← (Manus) → Research agent ← (Manus) → Generate Company Report ← (Manus AI)

**Form Fields (Required for Database Schema):**
- `client_name` (TEXT, NOT NULL) - Company/Client name
- `industry` (TEXT, NOT NULL) - Selected from dropdown (B2B SaaS, Marketing Agency, Financial Services, Healthcare, E-commerce, Technology, Real Estate, Education, Consulting, Other)
- `offer_service` (TEXT, NOT NULL) - Brief description of what they sell (2-3 sentences)
- `pricing` (TEXT, NOT NULL) - How is it priced? (e.g., $X/month, one-time $X, usage-based)
- `target_market` (TEXT, NOT NULL) - Who they think their customers are (specific description)
- `goals` (TEXT, NOT NULL) - What does success look like? (e.g., 50 meetings/month, $500K pipeline, 10% reply rate)
- `uploaded_files` (JSONB or separate table) - References to uploaded files

**Loading States (UI Only - for workflow tracking):**
1. Generating
2. Creating report
3. Validating report
4. Finding competitors

**Database Schema (To Be Created):**
```sql
CREATE TABLE company_profiles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  client_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  offer_service TEXT NOT NULL,
  pricing TEXT NOT NULL,
  target_market TEXT NOT NULL,
  goals TEXT NOT NULL,
  workflow_status TEXT DEFAULT 'pending', -- pending, generating, creating_report, validating_report, finding_competitors, completed
  manus_workflow_id TEXT, -- Reference to Manus AI workflow
  company_report JSONB, -- Generated report from Manus AI
  competitors_data JSONB, -- Competitor analysis data
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE TABLE company_profile_files (
  id UUID PRIMARY KEY,
  company_profile_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE projects (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  company_profile_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- Usually same as client_name, but can be customized
  status TEXT DEFAULT 'active', -- active, paused, completed, deleted
  logo_url TEXT, -- Reference to company logo
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP -- Soft delete
);
```

**Note:** When a `company_profile` workflow_status changes to 'completed', a trigger automatically creates a corresponding `project` record. Projects are displayed in the Projects tab with company cards showing logo, name, and status.

---

## 🗂️ Files to REMOVE

### Pages
- `src/app/tenants/page.tsx`
- `src/app/cron-monitor/page.tsx`
- `src/app/community/page.tsx` (if unused)
- `src/app/manual/page.tsx` (if unused)
- `src/app/metrics/page.tsx` (if unused)
- Test/demo pages: `/api-test`, `/cloudflare-test`, `/domain-status-test`, `/simple-domains`

### API Routes
- `src/app/api/admin/tenants/*`
- `src/app/api/admin/migrate-tenant-schema/route.ts`
- `src/app/api/manual/route.ts`
- `src/app/api/metrics/route.ts` (if unused)
- Any tenant-specific cron or setup routes

### Components
- Tenant-specific components
- Scan components (if not needed)
- Sidebar links pointing to removed pages

### SQL / Scripts
- `db/migrations/*tenant*`
- `db/migrations/*company*`
- `db/migrations/chat_*`
- `extend-tenants-for-company-model.sql`
- `create-companies-table.sql`

---

## 🔧 Files to MODIFY

- **`src/app/api/inboxing/deploy/route.ts`** → remove tenant dependency
- **`src/middleware.ts`** → remove tenants/cron references
- **`src/components/layout/sidebar.tsx`** → new navigation (dashboard, campaigns)
- **`create-billing-system-schema.sql`** → remove `company_id` FK if not needed

---

## ✅ Files to KEEP

- `src/app/domains/page.tsx` (legacy path, re-exported to `/infrastructure`)
- `src/app/infrastructure/page.tsx`
- `src/app/overview/page.tsx`
- `src/app/create-company/page.tsx` (Company profile creation form)
- `src/app/leads/page.tsx`
- `src/app/projects/page.tsx`
- `src/app/dns-records/page.tsx`
- `src/app/settings/page.tsx`
- `src/app/billing/page.tsx`
- `src/app/login/page.tsx`, `src/app/signup/page.tsx`
- `src/app/api/cloudflare/*`
- `src/app/api/inboxing/*` (refactor)
- `src/app/api/billing/*`
- `src/app/api/domains/*`
- `src/app/api/users/*`
- `src/app/api/projects/*` (Company projects API)
- `src/components/ui/*`, `src/components/domains/*`, `src/components/auth/*`
- `src/components/company/*` (Company profile components)
- `src/components/campaigns/*` (Campaign components)

---

## 🆕 New Features to BUILD

1. **Dashboard (`src/app/dashboard/`)**
   - Overview, stats, recent campaigns
   - Integration health

2. **Campaigns Module**
   - List, create, edit campaigns
   - Domain assignment
   - Analytics & status

3. **API Clients (`src/lib/api/`)**
   - `vibe-plus-client.ts`
   - `manus-ai-client.ts`
   - `campaign-service.ts`

4. **Campaign Components (`src/components/campaigns/`)**
   - `CampaignCard`, `CampaignForm`, `CampaignTable`
   - `DomainSelector`, `IntegrationStatus`

---

## 📝 Checklist

### Phase 1: Cleanup
- [x] Remove tenant pages & APIs
- [x] Remove cron monitor
- [x] Remove test/demo pages
- [x] Update inboxing deploy route
- [x] Update middleware & sidebar
- [x] Remove unused scan UI, hooks, cron scripts, setup/test utilities
- [ ] Clean database (drop tenant/company tables)

### Phase 2: Foundation
- [x] Create company profile database schema (`create-company-profiles-and-projects.sql`)
- [x] Create projects API route (`src/app/api/projects/route.ts`)
- [x] Update projects page to show company project cards
- [x] **COMPLETE DATABASE SCHEMA** - Created all tables (`create-complete-database-schema.sql`)
  - [x] Domains & Domain Assignments tables
  - [x] Campaigns table (with Vibe Plus sync support)
  - [x] Leads & Lead Imports tables
  - [x] Email Sent table (tracks emails from Vibe Plus)
  - [x] Email Replies table (tracks replies from Vibe Plus)
  - [x] Email Templates table
  - [x] Vibe Plus Connections & Sync History tables
  - [x] Reply Imports table
  - [x] Manus AI Queries table
  - [x] All RLS policies, indexes, triggers, and FK constraints
- [ ] Create dashboard structure
- [ ] Build new navigation
- [ ] Implement Manus AI workflow integration for company profiles

### Phase 3: Integration & Features
- [ ] Vibe Plus client + UI
- [ ] Manus AI query builder
- [ ] Campaign creation wizard
- [ ] Campaign analytics

---

## 📌 Notes

- Inboxing integration currently loops through tenants → needs refactor to direct deployment.
- Billing system references `company_id` → verify before removing companies.
- Domain management remains core -> integrate with campaigns.
- After cleanup, run database migrations to drop unused tables.

---

## ✅ Completed Work

### Database Schema (2025-01-17)
- **Complete database migration files created:**
  - `create-company-profiles-and-projects.sql` - Company profiles, files, and projects
  - `create-complete-database-schema.sql` - All remaining tables (domains, campaigns, leads, emails, etc.)
- **All tables include:**
  - Proper indexes for performance
  - Row Level Security (RLS) policies
  - Foreign key constraints
  - Auto-update triggers for timestamps
  - Campaign analytics triggers
- **Database design documents:**
  - `COMPLETE_DATABASE_MAP.md` - Full database schema documentation
  - `DATABASE_DESIGN.md` - Initial design document
  - `DATABASE_MIGRATION_GUIDE.md` - Migration instructions

### Key Database Features
- **Vibe Plus Integration Ready:**
  - `vibe_plus_connections` - Store API credentials
  - `vibe_plus_sync_history` - Track sync operations
  - Campaigns can sync with Vibe Plus campaigns
  - Email sent/replies synced from Vibe Plus (not platform-sent)
- **Lead Management:**
  - Supports multiple sources (Vibe Plus, Inboxing, Manual, CSV, Platform Upload)
  - Import tracking and history
- **Email Tracking:**
  - `email_sent` - Tracks emails synced from Vibe Plus
  - `email_replies` - Tracks replies synced from Vibe Plus
  - Links replies to sent emails
  - Campaign analytics auto-calculated

---

## 🚀 Next Up (Focus: One Task at a Time)

**Current Priority:** Choose ONE feature to build next:

1. **Vibe Plus API Client** - Build the client library to connect and sync data
2. **Campaigns API Routes** - CRUD operations for campaigns
3. **Leads API Routes** - CRUD and import functionality
4. **Email Sync Service** - Sync emails/replies from Vibe Plus
5. **Dashboard/Overview Page** - Display KPIs and stats

**Recommendation:** Start with **Vibe Plus API Client** to enable data syncing, then build API routes to display that data.

