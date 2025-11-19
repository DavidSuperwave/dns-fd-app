# Testing Manus Webhook & Integration

This document provides instructions on how to test the Manus AI webhook integration and verify that data is correctly being sent back to the application.

## 1. Prerequisites

- Ensure your local server is running: `npm run dev`
- Ensure you have `MANUS_API_KEY` in your `.env.local` file.

## 2. Testing the Webhook Manually

You can simulate a Manus webhook callback using `curl` to verify that your application correctly processes the data.

### Step 1: Get a valid Task ID
First, find a `manus_workflow_id` from your database for an existing Company Profile.
```sql
SELECT manus_workflow_id FROM company_profiles WHERE manus_workflow_id IS NOT NULL LIMIT 1;
```
*If you don't have one, create a new Company Profile first.*

### Step 2: Send a Mock Webhook Payload
Replace `YOUR_TASK_ID` with the ID from Step 1.

```bash
curl -X POST http://localhost:3000/api/manus/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "YOUR_TASK_ID",
    "status": "completed",
    "result": {
      "role": "assistant",
      "content": [
        {
          "type": "text",
          "text": "Here is the company report..."
        },
        {
          "type": "output_file",
          "file_url": "https://example.com/report.json"
        }
      ]
    }
  }'
```

### Step 3: Verify the Update
Check the server logs. You should see:
- `[Manus Webhook] Received webhook...`
- `[Manus Webhook] Phase completed...`
- `[Manus Webhook] Updated company profile...`

## 3. Verifying the Real Integration

1.  **Create a Company Profile**: Go to `/create-company` and submit the form.
2.  **Monitor Logs**: Watch your terminal for:
    - `[Manus AI] Task created...`
3.  **Wait for Completion**: Manus tasks usually take 1-3 minutes.
4.  **Check Webhook**: When the task completes, Manus will call your webhook.
    - Look for `[Manus Webhook] Received webhook` in the logs.
    - If the result is missing in the payload, the logs will show `Attempting to fetch from Manus API...`.
5.  **Check Project Tab**: Go to `/projects`.
    - Your new project should appear.
    - If it was in `generating` state, it should update to `reviewing` (for Phase 1) or `active`.

## 4. Troubleshooting

- **"Missing task_id"**: The payload sent to the webhook didn't have `task_id`.
- **"Company profile not found"**: The `task_id` in the webhook doesn't match any `manus_workflow_id` in your `company_profiles` table.
- **"Result is missing"**: The webhook payload didn't have the result. The system should automatically try to fetch it from the Manus API. Check logs for `Successfully fetched result from Manus API`.
