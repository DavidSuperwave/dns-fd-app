# Testing Manus Task Creation

## Quick Check Methods

### Method 1: SQL Query (Fastest)

Run this in your Supabase SQL Editor:

```sql
-- Find your "Superwave" company profile
SELECT 
  id,
  client_name,
  workflow_status,
  manus_workflow_id,
  company_report->>'current_phase' as current_phase,
  created_at
FROM company_profiles
WHERE client_name ILIKE '%superwave%'
ORDER BY created_at DESC
LIMIT 1;
```

**What to look for:**
- ✅ `manus_workflow_id` should have a value (like `task_xxxxx`)
- ✅ `workflow_status` should be `'generating'`
- ✅ `current_phase` should be `'phase_1_company_report'`

### Method 2: Debug API Endpoint

1. First, get your company profile ID from the SQL query above
2. Then call the debug endpoint:

```bash
# In browser console or terminal
fetch('/api/company-profiles/YOUR_COMPANY_PROFILE_ID/debug')
  .then(r => r.json())
  .then(data => {
    console.log('Debug Info:', data);
    console.log('Task ID:', data.debug?.companyProfile?.manus_workflow_id);
    console.log('Task Status:', data.debug?.taskStatus);
  });
```

### Method 3: Check Server Console Logs

Look for these logs in your terminal where Next.js is running:

```
[API Company Profiles] Creating company profile for user: ...
[API Company Profiles] Company profile created: ...
[Manus AI] File uploaded successfully: ... (if files were uploaded)
[Manus AI] Task created/continued: task_xxxxx
[API Company Profiles] Manus AI task created (Phase 1): task_xxxxx
```

**If you see errors:**
- `MANUS_API_KEY is not configured` → Add `MANUS_API_KEY` to `.env.local`
- `Failed to create Manus task` → Check API key is valid
- `Failed to get presigned URL` → Check Manus API is accessible

### Method 4: Check Browser Console

After submitting the form, open browser DevTools (F12) and check:
- Network tab → Look for `/api/company-profiles` POST request
- Console tab → Look for any error messages

## Common Issues & Fixes

### Issue: `manus_workflow_id` is NULL

**Possible causes:**
1. `MANUS_API_KEY` not set in `.env.local`
2. Manus API call failed (check server logs)
3. API key is invalid

**Fix:**
1. Add to `.env.local`:
   ```bash
   MANUS_API_KEY=your_actual_api_key_here
   ```
2. Restart Next.js dev server
3. Check server logs for errors

### Issue: Task created but status not updating

**Check:**
1. Webhook is registered: `POST /api/manus/webhook`
2. Webhook URL is correct in Manus dashboard
3. Server logs show webhook receiving updates

### Issue: Files not uploading to Manus

**Check:**
1. File size limits (10MB default)
2. File format is supported
3. Server logs for upload errors

## Step-by-Step Test

1. **Create Company Profile:**
   - Go to `/create-company`
   - Fill out form
   - Submit

2. **Check Database:**
   ```sql
   SELECT id, client_name, manus_workflow_id, workflow_status 
   FROM company_profiles 
   WHERE client_name = 'Superwave'
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

3. **Check Task Status:**
   - Get company profile ID from step 2
   - Call debug endpoint or check Manus dashboard

4. **Wait for Phase 1 to Complete:**
   - Check webhook logs
   - Or poll status endpoint: `/api/company-profiles/[id]/status`

5. **View Report:**
   - Go to `/projects/[project_id]/report`
   - Should see Phase 1 report data

## Quick SQL to Check Everything

```sql
-- Complete status check
SELECT 
  cp.id as company_profile_id,
  cp.client_name,
  cp.workflow_status,
  cp.manus_workflow_id,
  cp.company_report->>'current_phase' as current_phase,
  cp.company_report->'phases_completed' as phases_completed,
  CASE 
    WHEN cp.manus_workflow_id IS NOT NULL THEN '✅ Task Created'
    ELSE '❌ No Task'
  END as task_status,
  p.id as project_id,
  p.name as project_name,
  cp.created_at
FROM company_profiles cp
LEFT JOIN projects p ON p.company_profile_id = cp.id
WHERE cp.client_name ILIKE '%superwave%'
ORDER BY cp.created_at DESC;
```

