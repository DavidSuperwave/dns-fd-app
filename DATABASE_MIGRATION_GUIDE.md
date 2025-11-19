# Database Migration Guide

**Created:** 2025-01-17  
**Migration File:** `create-leads-replies-email-templates-campaigns.sql`

---

## Overview

This migration creates the core database tables needed for:
- **Campaigns** - Organize outreach efforts
- **Leads** - Store leads from various sources (Inboxing, Vibe Plus, Manual, CSV)
- **Email Replies** - Store imported email replies
- **Email Templates** - Store email copy/templates
- **Lead Imports** - Track lead import operations
- **Reply Imports** - Track reply import operations

---

## Prerequisites

Before running this migration, ensure you have:

1. ✅ **Company Profiles & Projects** tables created
   - Run `create-company-profiles-and-projects.sql` first
   - This migration references `projects` table

2. ✅ **Domains** table exists
   - Campaigns can reference domains for email sending

3. ✅ **User Profiles** table exists
   - All tables reference `auth.users` and may reference `user_profiles`

---

## Running the Migration

### Option 1: Supabase SQL Editor

1. Open your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `create-leads-replies-email-templates-campaigns.sql`
4. Paste and execute

### Option 2: Command Line (psql)

```bash
psql -h your-db-host -U postgres -d your-database -f create-leads-replies-email-templates-campaigns.sql
```

### Option 3: Supabase CLI

```bash
supabase db reset  # If you want to reset and apply all migrations
# OR
supabase migration new create_leads_replies_email_templates_campaigns
# Then copy the SQL into the migration file
supabase db push
```

---

## What Gets Created

### Tables

1. **campaigns** - Campaign management
2. **leads** - Lead storage with source tracking
3. **email_replies** - Email reply storage
4. **email_templates** - Email copy/templates
5. **lead_imports** - Lead import tracking
6. **reply_imports** - Reply import tracking

### Security

- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Policies ensure users can only access their own data
- ✅ Service role can access all data (for API operations)

### Performance

- ✅ Indexes on all foreign keys
- ✅ Indexes on commonly queried fields (status, source, email, etc.)
- ✅ Unique constraints to prevent duplicates

### Automation

- ✅ Triggers to auto-update `updated_at` timestamps
- ✅ Triggers to update campaign analytics (lead/reply counts)

---

## Table Relationships

```
User (auth.users)
  ├── Company Profile (company_profiles)
  │     └── Project (projects)
  │           ├── Campaign (campaigns)
  │           │     ├── Leads (leads)
  │           │     ├── Email Replies (email_replies)
  │           │     └── Email Templates (email_templates)
  │           ├── Leads (leads) [project-level]
  │           └── Email Templates (email_templates) [project-level]
  ├── Lead Imports (lead_imports)
  └── Reply Imports (reply_imports)
```

---

## Key Features

### 1. Source Tracking

All leads and replies track their source:
- `inboxing` - From Inboxing API
- `vibe_plus` - From Vibe Plus API
- `manus_ai` - From Manus AI
- `manual_import` - Manually imported
- `csv` - Imported from CSV file

### 2. Deduplication

Leads have a unique constraint on `(source, source_id)` to prevent duplicates from the same source.

### 3. Import Tracking

Both `lead_imports` and `reply_imports` track:
- Total processed, successful, skipped, failed counts
- Import options and errors
- Duration and timestamps

### 4. Email Threading

`email_replies` supports email threading via:
- `thread_id` - Groups related emails
- `in_reply_to` - Links to parent message
- `message_id` - Unique email identifier

### 5. Soft Deletes

Campaigns use soft deletes (`deleted_at`) for data retention.

---

## Next Steps

After running the migration:

1. **Create API Routes**
   - `/api/leads` - CRUD operations for leads
   - `/api/replies` - CRUD operations for replies
   - `/api/email-templates` - CRUD operations for templates
   - `/api/campaigns` - CRUD operations for campaigns
   - `/api/leads/import` - Lead import endpoint
   - `/api/replies/import` - Reply import endpoint

2. **Build Import Functions**
   - Inboxing API integration for leads/replies
   - Vibe Plus API integration
   - CSV import functionality
   - Manual import UI

3. **Update UI Components**
   - Leads page (`src/app/leads/page.tsx`) - Connect to real data
   - Campaign page - Connect to campaigns table
   - Email template editor

4. **Add Analytics**
   - Campaign performance metrics
   - Lead conversion tracking
   - Reply rate calculations

---

## Verification

After running the migration, verify tables were created:

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('campaigns', 'leads', 'email_replies', 'email_templates', 'lead_imports', 'reply_imports')
ORDER BY table_name;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('campaigns', 'leads', 'email_replies', 'email_templates', 'lead_imports', 'reply_imports');

-- Check indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('campaigns', 'leads', 'email_replies', 'email_templates', 'lead_imports', 'reply_imports')
ORDER BY tablename, indexname;
```

---

## Troubleshooting

### Error: relation "projects" does not exist

**Solution:** Run `create-company-profiles-and-projects.sql` first.

### Error: relation "domains" does not exist

**Solution:** Ensure your domains table exists. This is optional - campaigns can work without domain references.

### Error: duplicate key value violates unique constraint

**Solution:** This is expected if you're trying to import duplicate leads from the same source. The unique constraint on `(source, source_id)` prevents duplicates.

### RLS policies blocking access

**Solution:** Ensure you're authenticated and using the correct user context. Service role should have full access.

---

## Support

For issues or questions:
1. Check the `DATABASE_DESIGN.md` for detailed schema documentation
2. Review RLS policies in the migration file
3. Verify your user has proper authentication

---

## Rollback (if needed)

To rollback this migration:

```sql
BEGIN;

-- Drop triggers
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
DROP TRIGGER IF EXISTS update_email_replies_updated_at ON email_replies;
DROP TRIGGER IF EXISTS update_email_templates_updated_at ON email_templates;
DROP TRIGGER IF EXISTS on_lead_created_update_campaign ON leads;
DROP TRIGGER IF EXISTS on_reply_created_update_campaign ON email_replies;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS update_campaign_lead_count();
DROP FUNCTION IF EXISTS update_campaign_reply_count();

-- Drop tables (in reverse order due to foreign keys)
DROP TABLE IF EXISTS reply_imports CASCADE;
DROP TABLE IF EXISTS lead_imports CASCADE;
DROP TABLE IF EXISTS email_templates CASCADE;
DROP TABLE IF EXISTS email_replies CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;

COMMIT;
```

**⚠️ Warning:** This will delete all data in these tables. Only use if you're sure you want to remove everything.

