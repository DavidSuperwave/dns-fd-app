# Create Company Workflow - Testing Guide

**Date:** 2025-01-17  
**Status:** Ready for Testing

---

## ✅ What's Been Built

### API Routes
1. **POST /api/company-profiles** - Creates company profile
   - Accepts form data (clientName, industry, offerService, pricing, targetMarket, goals)
   - Handles file uploads (base64 encoded)
   - Creates `company_profiles` record with `workflow_status = 'pending'`
   - Uploads files to Supabase Storage bucket `company-profile-files`
   - Creates `company_profile_files` records

2. **GET /api/company-profiles/[id]** - Get company profile status
   - Returns company profile with current workflow_status
   - Includes associated files
   - Includes project if workflow is completed

3. **POST /api/company-profiles/[id]/complete** - Manually complete workflow (for testing)
   - Sets `workflow_status = 'completed'`
   - Triggers database trigger to auto-create project
   - Returns created project

### Frontend Updates
1. **Form Submission** - Now calls API
   - Converts files to base64
   - Sends all form data to API
   - Handles errors

2. **Status Polling** - Polls every 5 seconds
   - Checks workflow status
   - Updates UI with real status
   - Redirects to projects page when completed

3. **Loading States** - Uses real workflow status
   - Maps status to loading state index
   - Shows completion when status = 'completed'

---

## 🧪 Testing Steps

### Step 1: Test Basic Workflow (No Files)
1. Go to `/create-company`
2. Fill out the form:
   - Client Name: "Test Company"
   - Industry: "B2B SaaS"
   - Offer/Service: "We provide cloud-based solutions"
   - Pricing: "$99/month"
   - Target Market: "Small businesses"
   - Goals: "50 meetings/month"
3. Click "Create Company Profile"
4. **Expected:** 
   - Loading states show
   - Company profile created in database
   - Status stays as 'pending' (no Manus AI yet)

### Step 2: Test File Upload
1. Repeat Step 1, but add files
2. Upload 1-2 test files
3. **Expected:**
   - Files uploaded to Supabase Storage
   - `company_profile_files` records created
   - Files visible in API response

### Step 3: Test Manual Completion (Test Project Creation)
1. After creating a company profile, note the `companyProfileId` from response
2. Call the complete endpoint:
   ```bash
   POST /api/company-profiles/[id]/complete
   ```
   Or use browser console:
   ```javascript
   fetch('/api/company-profiles/[COMPANY_PROFILE_ID]/complete', {
     method: 'POST'
   }).then(r => r.json()).then(console.log)
   ```
3. **Expected:**
   - `workflow_status` changes to 'completed'
   - Database trigger creates a `project` record
   - Project visible in `/projects` page

### Step 4: Test Full Flow
1. Create company profile
2. Manually complete it (Step 3)
3. **Expected:**
   - Polling detects completion
   - Redirects to `/projects`
   - Project card visible

---

## 🔍 Verification Queries

### Check Company Profile
```sql
SELECT * FROM company_profiles 
WHERE user_id = '[YOUR_USER_ID]' 
ORDER BY created_at DESC 
LIMIT 1;
```

### Check Files
```sql
SELECT * FROM company_profile_files 
WHERE company_profile_id = '[COMPANY_PROFILE_ID]';
```

### Check Project (should exist if workflow_status = 'completed')
```sql
SELECT * FROM projects 
WHERE company_profile_id = '[COMPANY_PROFILE_ID]';
```

---

## 🐛 Known Issues / Notes

1. **Storage Bucket**: The API will try to create `company-profile-files` bucket if it doesn't exist. You may need to create it manually in Supabase Dashboard if you get permission errors.

2. **File Upload**: Files are sent as base64 in JSON. For large files, consider using FormData with direct storage upload instead.

3. **Workflow Status**: Currently stays as 'pending' until manually completed. When Manus AI is integrated, this will update automatically.

4. **Polling**: Polls every 5 seconds for up to 5 minutes. Adjust if needed.

---

## 📝 Next Steps (After Testing)

1. **Add Manus AI Integration** - Start workflow on company creation
2. **Improve File Upload** - Use direct storage upload (not base64)
3. **Add Error Handling** - Better error messages and retry logic
4. **Add Progress Updates** - Real-time status updates via webhooks or SSE

---

## 🚀 Quick Test Script

To quickly test the complete workflow:

```javascript
// 1. Create company profile
const createResponse = await fetch('/api/company-profiles', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    clientName: 'Test Company',
    industry: 'B2B SaaS',
    offerService: 'Test service',
    pricing: '$99/month',
    targetMarket: 'Small businesses',
    goals: '50 meetings/month',
    files: []
  })
});
const { companyProfile } = await createResponse.json();
console.log('Created:', companyProfile.id);

// 2. Complete workflow
const completeResponse = await fetch(`/api/company-profiles/${companyProfile.id}/complete`, {
  method: 'POST'
});
const result = await completeResponse.json();
console.log('Completed:', result);
```

