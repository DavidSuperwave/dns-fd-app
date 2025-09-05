# User Invitation System Fix

## Issues Identified

The user invitation system was failing with a 500 error due to several issues:

### 1. **Missing Database Table**
- The API was trying to insert into an `invitations` table that didn't exist
- Multiple invitation table schemas existed but none matched what the API expected

### 2. **Broken Supabase Admin Client**
- The code was importing `supabaseAdmin` from `supabase-client.ts` but it was not properly initialized
- The admin client was needed for database operations and user management

### 3. **Inconsistent Error Handling**
- The API had redundant error checks that were causing additional issues
- Email failures were not properly communicated to the client

## Fixes Applied

### 1. **Fixed Supabase Admin Client Import**
```typescript
// Before
import { supabaseAdmin } from '../../../lib/supabase-client';

// After  
import { createAdminClient } from '../../../lib/supabase-admin';

// Create client dynamically
const supabaseAdmin = createAdminClient();
```

### 2. **Created Proper Database Schema**
Created `create-invitations-table.sql` with the correct schema:

```sql
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    token TEXT NOT NULL UNIQUE,
    created_by TEXT DEFAULT 'system',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    used_at TIMESTAMP WITH TIME ZONE
);
```

### 3. **Added Setup API Endpoint**
Created `/api/setup/create-invitations-table` to:
- Check if the invitations table exists
- Create the table if it doesn't exist
- Set up proper Row Level Security policies

### 4. **Enhanced Error Handling**
- Improved error messages and logging
- Better separation of database vs email errors
- Added proper status codes for different error types

### 5. **Added Admin Setup Component**
Created `SetupInvitationsButton` component for easy table setup:
- Check table existence
- Create table if needed
- Provide clear feedback to admins

## How to Fix the Issue

### Option 1: Automatic Setup (Recommended)
1. Go to the Users page in the admin dashboard
2. Click "Check Invitations Table" to verify status
3. Click "Setup Invitations Table" if needed
4. Try sending an invitation

### Option 2: Manual Setup
1. Open your Supabase SQL Editor
2. Run the SQL script from `create-invitations-table.sql`
3. Try sending an invitation

### Option 3: API Setup
```bash
# Check table status
curl -X GET "http://localhost:3001/api/setup/create-invitations-table"

# Create table
curl -X POST "http://localhost:3001/api/setup/create-invitations-table"
```

## Environment Variables Required

Make sure these are set in your environment:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RESEND_API_KEY=your_resend_api_key (for email sending)
DEFAULT_SENDER_EMAIL=your_verified_sender_email
```

## Testing the Fix

1. Go to `/users` page as an admin
2. Click "Setup Invitations Table" if table doesn't exist
3. Try inviting a user with the "Invite User" button
4. Check the browser console and network tab for any errors
5. Verify the invitation was created in the database

## Common Issues

### Email Sending Fails
- Check if `RESEND_API_KEY` is set
- Verify `DEFAULT_SENDER_EMAIL` is a verified domain in Resend
- The invitation will still be created even if email fails

### Database Permission Errors
- Ensure the service role key has proper permissions
- Check Row Level Security policies are correctly set

### Table Already Exists Errors
- The script uses `IF NOT EXISTS` so it's safe to run multiple times
- Existing data won't be affected

## Files Modified

1. `/src/app/api/invitations/route.ts` - Fixed admin client and error handling
2. `/create-invitations-table.sql` - Database schema
3. `/src/app/api/setup/create-invitations-table/route.ts` - Setup API
4. `/src/components/admin/setup-invitations-button.tsx` - Setup UI component
5. `/src/app/users/page.tsx` - Added setup button to admin interface

The invitation system should now work correctly after running the setup process.
