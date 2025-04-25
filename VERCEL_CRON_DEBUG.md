# Vercel Cron Debugging and Simulation

This document explains how to test, debug, and work with the Vercel cron jobs we've set up for automatic Cloudflare to Supabase synchronization.

## Overview

Vercel Cron Jobs allow us to run scheduled tasks at specific intervals. In this project, we use cron jobs to:

1. Synchronize Cloudflare domain data to Supabase every hour
2. Maintain history of sync operations
3. Ensure our database is always up-to-date

## Running with Cron Simulation

We've created a special development mode that simulates Vercel cron jobs locally:

```bash
# Kill all running processes and start in cron debug mode
npm run dev:cron
```

This script:
1. Kills any processes running on development ports (3000-3006)
2. Starts vercel dev on port 3000 with enhanced debugging
3. Allows you to simulate and test cron jobs locally

## Testing Cron Jobs

You can test cron jobs in several ways:

### 1. Using the Cron Monitor UI

Navigate to http://localhost:3000/cron-monitor in your browser after starting the server.

The Cron Monitor dashboard provides:
- Real-time monitoring of sync operations
- History of previous syncs
- Ability to trigger manual syncs
- Option to simulate a Vercel cron job

### 2. Using the Command Line

We've added convenience commands to the package.json:

```bash
# Simulate a Vercel cron job (as if scheduled)
npm run cron:simulate

# Trigger a manual sync (requires authentication)
npm run cron:trigger
```

### 3. Using Direct API Requests

You can directly call the cron endpoints:

```bash
# Simulate a Vercel cron job with proper headers
curl -X GET "http://localhost:3000/api/cron/sync" \
  -H "User-Agent: vercel-cron/1.0" \
  -H "x-vercel-cron: true"

# Trigger a manual sync (requires authentication)
curl -X POST "http://localhost:3000/api/cron/manual-sync" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Debugging Cron Jobs

The cron endpoints have been enhanced with extensive logging:

1. All requests and key parameters are logged
2. Execution steps are tracked with timestamps
3. Important data points are captured for debugging
4. Success/failure is recorded with detailed error information

To view these logs:
- Check the console output when running in dev mode
- View the sync history in the Cron Monitor UI
- Check the Supabase `sync_history` table for permanent records

## Setting Up Required Tables

Before the cron jobs can work properly, you need to ensure the required database tables exist:

```bash
# Run the table setup script
npm run setup:sync-tables

# Alternatively, you can directly call the setup endpoint
curl -X GET "http://localhost:3000/api/supabase/setup-sync-tables?key=superwave-setup-secret-key"
```

This will create:
1. `domains` table - Stores synchronized domain data
2. `sync_history` table - Records all sync operations with metrics

## Vercel.json Configuration

The cron job is configured in `vercel.json`:

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

This configuration runs the sync job every hour at minute 0 (e.g., 1:00, 2:00, 3:00).

## Troubleshooting

If you encounter issues with the cron jobs:

1. **"Table doesn't exist" error**: Run the setup script or endpoint to create required tables
2. **Authentication errors**: Ensure you have proper authorization headers for manual syncs
3. **Cloudflare API errors**: Check your Cloudflare API token is valid
4. **Sync history not showing**: Make sure the Supabase RLS policies are correctly configured

## Production Deployment

When deploying to Vercel:

1. The cron job will automatically be scheduled based on the vercel.json configuration
2. You can monitor executions in the Vercel dashboard under "Cron Jobs"
3. The Cron Monitor UI will display a history of all production sync operations

For more information, refer to the [Vercel Cron Documentation](https://vercel.com/docs/cron-jobs).