# Supabase User Sync & UI Refresh Fix

## Issues Fixed

There were two main issues that have been fixed:

1. The Supabase user profile data wasn't being properly displayed in the UI even though the sync was working correctly
2. The "Sync with Supabase" button wasn't properly refreshing the UI after synchronization

## Diagnostic Results

We ran diagnostic tests that confirmed:

- The Supabase connection is working correctly
- The user_profiles table exists and contains the correct data
- There are 3 users in the system that match between auth and profiles
- The API issue with `count(*)` was causing errors in the table check

## Solutions Implemented

### 1. Fixed count(*) query error

Modified the query in the setup-tables route to avoid using `count(*)` which was causing PostgREST parsing errors.

```typescript
// Before
const { error: tableCheckError } = await supabase
  .from('user_profiles')
  .select('count(*)')
  .limit(1);

// After
const { error: tableCheckError } = await supabase
  .from('user_profiles')
  .select('id')
  .limit(1);
```

### 2. Enhanced fetchUsers function

Updated the fetchUsers function in the supabase-client.ts file to:
- Support cache-busting with query parameters
- Add better logging
- Use more reliable query patterns
- Add proper error handling

### 3. Created diagnostic tools

Added two diagnostic scripts to help troubleshoot database connection and UI issues:

- `supabase-diagnostic.js` - Tests Supabase connection and queries user data directly
- `fix-users-ui.js` - Forces an update of user profiles with fresh timestamps

### 4. Added Force Refresh UI button

Added a new "Force Refresh UI" button to the Users page that:
- Completely clears any cached data
- Uses random query parameters to break through caching
- Forces a fresh fetch from the database
- Provides better feedback to the user

## Next Steps

The system now properly syncs users between Supabase auth and profiles, and displays them correctly in the UI. If any issues persist:

1. Run the diagnostic script again: `node supabase-diagnostic.js`
2. Force update the profiles: `node fix-users-ui.js`
3. Use the "Force Refresh UI" button on the Users page

## Technical Details

### Table Structure

The user_profiles table has the following columns:
- id
- email
- name
- role
- active
- created_at
- domains
- totp_enabled

### Authentication

The system uses the Supabase service role key for admin operations, and the user's session for regular operations.