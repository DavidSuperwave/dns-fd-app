# Vercel Cron Setup for Cloudflare to Supabase Synchronization

This document explains how the automatic synchronization between Cloudflare domain data and Supabase is configured using Vercel Cron Jobs.

## Overview

The application automatically synchronizes domain data from Cloudflare to Supabase on an hourly basis using Vercel's Cron Jobs feature. This ensures that the Supabase database always has an up-to-date copy of all domains from Cloudflare without requiring manual intervention.

## How It Works

1. **Scheduled Execution**: A cron job is configured in `vercel.json` to run every hour.
2. **API Endpoint**: The cron job calls the `/api/cron/sync` endpoint.
3. **Synchronization Process**:
   - The endpoint fetches domain data from Cloudflare
   - It upserts this data to the Supabase `domains` table
   - It records the sync attempt in the `sync_history` table
   - The sync is secured using a secret key and User-Agent verification

## Configuration

### vercel.json

The cron job is defined in the project's `vercel.json` file:

```json
{
  "version": 2,
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "0 * * * *"
    }
  ]
}
```

This configuration runs the job at minute 0 of every hour (e.g., 1:00, 2:00, 3:00).

### Environment Variables

The following environment variables are used:

- `NEXT_PUBLIC_SUPABASE_URL`: The URL of your Supabase project
- `SUPABASE_SERVICE_ROLE_KEY`: The service role key for admin operations
- `CRON_SECRET`: A secret key to authorize cron job requests (optional, added security)

### Database Tables

Two tables are used for the synchronization:

1. **domains**:
   - Stores domain information from Cloudflare
   - Primary key: `id` (auto-incremented)
   - Unique constraint: `cloudflare_id`
   - Includes fields for status, creation date, etc.

2. **sync_history**:
   - Records each synchronization attempt
   - Includes timestamp, success status, error messages, and metrics
   - Enables monitoring of the sync process

## Security

The sync endpoint incorporates multiple layers of security:

1. **Vercel-Cron User-Agent**: Verifies that requests come from Vercel's cron service
2. **Secret Key**: Optional bearer token authentication
3. **URL Parameter**: Alternative method for passing the secret key
4. **Row-Level Security**: Supabase tables are secured with RLS policies

## Manual Synchronization

In addition to the automatic hourly sync, administrators can trigger a manual sync:

1. Navigate to the domains management page
2. Click the "Sync with Cloudflare" button
3. The system will execute the same synchronization process

## Setup Process

To set up the synchronization:

1. Deploy the application to Vercel
2. Ensure the required environment variables are set
3. The system will automatically create necessary tables on first sync
4. Alternatively, run the setup endpoint: `/api/supabase/setup-sync-tables`

## Troubleshooting

If synchronization is not working:

1. Check Vercel logs for any errors in the cron job execution
2. Verify that the database tables exist and have the correct structure
3. Ensure that the Cloudflare API token has the necessary permissions
4. Check the `sync_history` table for error messages from previous sync attempts

## Monitoring

The sync process can be monitored through:

1. **Sync History**: View recent syncs in the `sync_history` table
2. **Vercel Logs**: Check logs for the function execution
3. **Dashboard**: Administrators can view sync statistics in the app dashboard

For additional support or questions, please contact the development team.