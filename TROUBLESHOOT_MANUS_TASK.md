# Troubleshooting: Manus Task Not Created

## Quick Checks

### 1. Check Environment Variable

**Check if `MANUS_API_KEY` is set:**

```bash
# In your terminal (project root)
echo $MANUS_API_KEY
```

**Or check `.env.local` file:**
```bash
cat .env.local | grep MANUS_API_KEY
```

**Should see:**
```
MANUS_API_KEY=your_actual_api_key_here
```

### 2. Check Server Console Logs

After creating a company profile, check your Next.js server terminal for:

**✅ Success logs:**
```
[API Company Profiles] Manus AI task created (Phase 1): task_xxxxx
```

**❌ Error logs:**
```
[API Company Profiles] Error starting Manus AI workflow: ...
[Manus AI] MANUS_API_KEY is not set in environment variables
```

### 3. Check Browser Console

After submitting the form, open browser DevTools (F12) → Console tab:

Look for the API response:
```javascript
// Should show warning if task wasn't created
{
  success: true,
  warning: "Manus task was not created. Check server logs..."
}
```

### 4. Check Database

Run this SQL:
```sql
SELECT 
  id,
  client_name,
  workflow_status,
  manus_workflow_id,
  created_at
FROM company_profiles
WHERE client_name ILIKE '%superwave%'
ORDER BY created_at DESC
LIMIT 1;
```

**If `manus_workflow_id` is NULL:**
- Task creation failed
- Check server logs for error
- Verify `MANUS_API_KEY` is set

## Common Issues & Fixes

### Issue 1: `MANUS_API_KEY` Not Set

**Symptoms:**
- `manus_workflow_id` is NULL
- Server log: `MANUS_API_KEY is not configured`
- `workflow_status` is `'pending'` instead of `'generating'`

**Fix:**
1. Create/update `.env.local` in project root:
   ```bash
   MANUS_API_KEY=your_actual_manus_api_key
   ```
2. **Restart Next.js dev server** (important!)
3. Try creating company profile again

### Issue 2: Invalid API Key

**Symptoms:**
- Server log: `Failed to create Manus task: 401` or `403`
- Error message about authentication

**Fix:**
1. Verify API key is correct in Manus dashboard
2. Check for extra spaces or quotes in `.env.local`
3. Restart server

### Issue 3: Network/API Error

**Symptoms:**
- Server log: `Failed to create Manus task: [status code]`
- Connection timeout errors

**Fix:**
1. Check internet connection
2. Verify Manus API is accessible: `https://api.manus.ai`
3. Check firewall/proxy settings

### Issue 4: Server Not Restarted

**Symptoms:**
- Added `MANUS_API_KEY` but still not working
- Environment variable not being read

**Fix:**
1. **Stop** Next.js server (Ctrl+C)
2. **Start** it again: `npm run dev`
3. Environment variables are only loaded on server start

## Step-by-Step Debug

1. **Check `.env.local` exists:**
   ```bash
   ls -la .env.local
   ```

2. **Verify key format:**
   ```bash
   # Should be one line, no quotes
   MANUS_API_KEY=actual_key_here
   ```

3. **Restart server:**
   ```bash
   # Stop current server
   # Then restart
   npm run dev
   ```

4. **Create company profile again**

5. **Check server logs immediately** for:
   - `[API Company Profiles] Manus AI task created`
   - OR error messages

6. **Check database:**
   ```sql
   SELECT manus_workflow_id, workflow_status 
   FROM company_profiles 
   WHERE client_name = 'Superwave'
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

## Manual Test

Test the Manus API directly:

```bash
# In terminal
curl -X POST https://api.manus.ai/v1/tasks \
  -H "API_KEY: YOUR_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Test prompt",
    "agentProfile": "manus-1.5"
  }'
```

**If this works:** API key is valid, issue is in code
**If this fails:** API key is invalid or network issue

## Quick Fix Script

Run this to check everything:

```bash
# Check if .env.local exists
if [ -f .env.local ]; then
  echo "✅ .env.local exists"
  if grep -q "MANUS_API_KEY" .env.local; then
    echo "✅ MANUS_API_KEY found in .env.local"
  else
    echo "❌ MANUS_API_KEY NOT found in .env.local"
  fi
else
  echo "❌ .env.local does NOT exist"
fi
```

