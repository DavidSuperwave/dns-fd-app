# How to Fetch and Save Manus Result

## Step 1: Get Your Company Profile ID

Run this SQL query in Supabase:

```sql
SELECT id, client_name, manus_workflow_id 
FROM company_profiles 
WHERE manus_workflow_id = 'NWSy4Rnu9MfErVdjSZLxTb';
```

Copy the `id` value (it's a UUID).

## Step 2: Call the API Endpoint

### Option A: From Browser Console

1. Open your browser console (F12)
2. Navigate to any page on your app (logged in)
3. Run this (replace `YOUR_COMPANY_PROFILE_ID` with the ID from Step 1):

```javascript
fetch('/api/company-profiles/9a454676-1227-4fbb-ac16-97bb6bfbde58/fetch-manus-result', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
})
  .then(response => response.json())
  .then(data => {
    console.log('Success:', data);
    // Refresh the page to see the report
    window.location.reload();
  })
  .catch(error => {
    console.error('Error:', error);
  });
```

### Option B: Using curl (from terminal)

```bash
curl -X POST http://localhost:3000/api/company-profiles/YOUR_COMPANY_PROFILE_ID/fetch-manus-result \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie-here"
```

## Step 3: Verify It Worked

After calling the endpoint, check the database:

```sql
SELECT 
  id,
  client_name,
  company_report->'phase_data'->'phase_1_company_report' as phase_1_data
FROM company_profiles 
WHERE id = 'YOUR_COMPANY_PROFILE_ID';
```

You should see the JSON data in `phase_1_data`.

## Step 4: Refresh the Report Page

Go to `/projects/[project-id]/report` and the report should now display!

