# Projects Not Showing on Dashboard - Debug Guide

**Issue:** Projects exist in database but don't show on `/projects` page

---

## 🔍 Common Causes

### 1. User ID Mismatch (Most Common)
The project's `user_id` doesn't match your logged-in user ID.

**Check:**
```sql
-- Get your user ID
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Check projects and their user_ids
SELECT id, name, user_id, status, deleted_at 
FROM projects 
ORDER BY created_at DESC;

-- Compare: Does the project's user_id match your auth.users.id?
```

**Fix:** If they don't match, update the project:
```sql
UPDATE projects 
SET user_id = 'YOUR_USER_ID_HERE' 
WHERE id = 'PROJECT_ID_HERE';
```

### 2. Deleted Status
Project might have `deleted_at` set or `status = 'deleted'`.

**Check:**
```sql
SELECT id, name, status, deleted_at 
FROM projects 
WHERE id = 'YOUR_PROJECT_ID';
```

**Fix:** If `deleted_at` is set, clear it:
```sql
UPDATE projects 
SET deleted_at = NULL, status = 'active' 
WHERE id = 'YOUR_PROJECT_ID';
```

### 3. API Authentication Issue
The API might not be recognizing your session.

**Check:**
- Open browser console on `/projects` page
- Look for `[API Projects]` logs
- Check if you see "Fetched projects for user: [your-user-id]"

---

## 🛠️ Quick Fixes

### Option 1: Check Browser Console
1. Go to `/projects` page
2. Open browser DevTools (F12)
3. Check Console tab
4. Look for logs starting with `[Projects Page]` or `[API Projects]`
5. See what's being returned

### Option 2: Test API Directly
Open browser console and run:
```javascript
fetch('/api/projects?filter=all')
  .then(r => r.json())
  .then(data => {
    console.log('API Response:', data);
    console.log('Projects:', data.projects);
    console.log('Count:', data.projects?.length || 0);
  });
```

### Option 3: Verify Project Data
Run this SQL to see all your projects:
```sql
SELECT 
  p.id,
  p.name,
  p.status,
  p.user_id,
  p.deleted_at,
  u.email as user_email
FROM projects p
LEFT JOIN auth.users u ON p.user_id = u.id
ORDER BY p.created_at DESC;
```

---

## 🐛 Debug Steps

1. **Check Console Logs**
   - Added console.log statements to both API and frontend
   - Look for: `[API Projects]` and `[Projects Page]` logs

2. **Use Refresh Button**
   - Click "Refresh" button on projects page
   - This will re-fetch and show new console logs

3. **Check Error Message**
   - If there's an error, it will show in red at the top
   - Error will indicate what went wrong

4. **Verify User ID Match**
   - Most common issue: project.user_id ≠ logged-in user.id
   - Check both in database and console logs

---

## ✅ Expected Behavior

When working correctly:
1. API returns projects with `user_id` matching logged-in user
2. Console shows: `[API Projects] Fetched projects for user: [uuid] Count: [number]`
3. Console shows: `[Projects Page] Fetched projects: { success: true, projects: [...] }`
4. Cards appear on page

---

## 🔧 Manual Fix (If User ID Mismatch)

If the project was created with wrong user_id:

```sql
-- Find your user ID
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Update project to your user_id
UPDATE projects 
SET user_id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com')
WHERE id = 'project-id-here';
```

---

## 📝 Next Steps

After checking console logs:
1. Share the console output
2. Check if user_id matches
3. Verify project status and deleted_at
4. Test with Refresh button

The added logging will help identify the exact issue!

