# Manus AI Integration Setup Guide

This guide explains how to set up and use the Manus AI integration for company profile generation.

## 🔧 Environment Variables

Add the following to your `.env.local` file:

```bash
MANUS_API_KEY=your_manus_api_key_here
```

**Important:** Never expose your API key in frontend code. It's only used in server-side API routes.

## 📋 Integration Overview

The Manus AI integration works as follows:

1. **User submits company profile form** → Creates company profile in database
2. **Files uploaded** → Uploaded to both Supabase Storage (for records) and Manus AI (for analysis)
3. **Kickoff prompt constructed** → Dynamically built from form data
4. **Manus task created** → Task created with prompt and file attachments
5. **Workflow status updated** → Status changes from `pending` → `generating` → `creating_report` → `validating_report` → `finding_competitors` → `completed`
6. **Project auto-created** → Database trigger creates project when status = `completed`

## 🔄 Workflow Status Flow

```
pending → generating → creating_report → validating_report → finding_competitors → completed
```

- **pending**: Company profile created, waiting to start Manus workflow
- **generating**: Manus task created, AI is working
- **creating_report**: Report generation in progress
- **validating_report**: Report validation in progress
- **finding_competitors**: Competitor analysis in progress
- **completed**: Workflow complete, project auto-created

## 📡 Webhook Setup (Optional but Recommended)

To receive real-time updates from Manus AI, set up a webhook:

1. **Get your webhook URL:**
   ```
   https://your-domain.com/api/manus/webhook
   ```

2. **Register the webhook** (one-time setup):
   ```typescript
   import { registerManusWebhook } from '@/lib/manus-ai-client';
   
   await registerManusWebhook('https://your-domain.com/api/manus/webhook', [
     'task.completed',
     'task.failed'
   ]);
   ```

3. **Or use Manus dashboard** to register the webhook manually

## 🔍 Status Polling (Alternative to Webhooks)

If you don't use webhooks, the frontend can poll for status updates:

```typescript
// Poll every 5 seconds
const checkStatus = async () => {
  const response = await fetch(`/api/company-profiles/${companyProfileId}/status`);
  const data = await response.json();
  // Update UI based on data.workflow_status
};
```

## 📁 File Upload Process

Files are uploaded to both:
1. **Supabase Storage** - For your records and future reference
2. **Manus AI** - For AI analysis

The process:
1. File converted to Buffer from base64
2. Uploaded to Supabase Storage bucket `company-profile-files`
3. Uploaded to Manus AI via presigned URL
4. File IDs stored for task attachments

## 🎯 API Endpoints

### Create Company Profile (with Manus integration)
```
POST /api/company-profiles
```

**Request Body:**
```json
{
  "clientName": "Acme Corp",
  "industry": "B2B SaaS",
  "offerService": "Workflow automation software",
  "pricing": "$99/month",
  "targetMarket": "Mid-market B2B companies",
  "goals": "50 meetings/month",
  "files": [
    {
      "name": "document.pdf",
      "type": "application/pdf",
      "data": "base64_encoded_file_data"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "companyProfile": {
    "id": "uuid",
    "client_name": "Acme Corp",
    "workflow_status": "generating",
    "manus_workflow_id": "task_id",
    "manus_task_url": "https://manus.ai/task/...",
    "created_at": "2025-01-17T..."
  },
  "files": [...],
  "manusTask": {
    "task_id": "task_id",
    "task_url": "https://manus.ai/task/..."
  }
}
```

### Check Workflow Status
```
GET /api/company-profiles/[id]/status
```

**Response:**
```json
{
  "success": true,
  "workflow_status": "creating_report",
  "manus_status": "running",
  "companyProfile": {...}
}
```

### Manus Webhook Handler
```
POST /api/manus/webhook
```

Receives updates from Manus AI and automatically updates company profile status.

## 🧪 Testing

1. **Set up environment variable:**
   ```bash
   MANUS_API_KEY=test_key_here
   ```

2. **Create a company profile** via the form
3. **Check console logs** for Manus API calls
4. **Monitor workflow status** via status endpoint
5. **Verify project creation** when status = `completed`

## 🐛 Troubleshooting

### Manus API Key Not Set
- Error: `MANUS_API_KEY is not configured`
- Fix: Add `MANUS_API_KEY` to `.env.local`

### File Upload Fails
- Check file size limits (10MB default)
- Verify file format is supported by Manus
- Check console logs for specific error

### Workflow Stuck
- Check Manus task status directly via Manus dashboard
- Verify webhook is receiving updates
- Use status polling endpoint to manually check

### Project Not Created
- Verify workflow_status = `completed` in database
- Check database trigger exists: `on_company_profile_completed`
- Run diagnostic SQL: `check-projects-exist.sql`

## 📝 Next Steps

1. ✅ Manus API client created
2. ✅ Kickoff prompt template created
3. ✅ Company profile API integrated
4. ✅ Webhook handler created
5. ⏳ Test complete workflow
6. ⏳ Add error handling and retry logic
7. ⏳ Add UI for viewing Manus task progress

## 🔗 Related Files

- `src/lib/manus-ai-client.ts` - Manus API client
- `src/lib/manus-kickoff-prompt.ts` - Prompt template builder
- `src/app/api/company-profiles/route.ts` - Company profile creation with Manus
- `src/app/api/manus/webhook/route.ts` - Webhook handler
- `src/app/api/company-profiles/[id]/status/route.ts` - Status checker

