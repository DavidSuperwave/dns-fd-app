# Debugging Summary: CSV Upload and Supabase Storage Issues (2025-04-29)

## Initial Problem

The user reported that uploading a CSV file containing three columns (`DisplayName`, `EmailAddress`, `Password`) via the application's CSV upload feature was failing. The initial error message observed in the UI was generic ("An unexpected error occurred while reading the CSV file. Please check the file format.").

## Investigation Steps & Findings

1.  **CSV Validator Analysis (`src/lib/csv-validator.ts`):**
    *   Initial review showed the validator was designed to strictly handle only `DisplayName` and `EmailAddress` columns. It ignored any third column.
    *   Several attempts were made to modify the validator's parsing logic (`validateCsvContent` function) to correctly handle the optional third "Password" column without throwing errors. This involved adjusting header detection, row processing, and using different options for the `csv-parse` library (`relax_column_count: true`, `bom: true`).
    *   Despite these changes, the generic "unexpected error" persisted in the UI, suggesting the root cause was not solely within the validator's parsing logic itself.

2.  **Console Log Analysis:**
    *   We examined the browser's developer console logs during an upload attempt.
    *   Crucially, no detailed parsing errors from `csv-parse` (like the expected `[CSV Validator] DETAILED PARSING ERROR OBJECT:`) were found.
    *   Instead, two distinct errors related to Supabase permissions were identified:

        a.  **Storage RLS Error:**
            *   **Error Message:** `StorageApiError: new row violates row-level security policy`
            *   **Context:** This error occurred within the `loadFiles` function in `src/components/domains/csv-upload.tsx` when attempting to list files from the `domain-csv-files` storage bucket using `supabase.storage.from('domain-csv-files').list(domainId)`.
            *   **Implication:** This indicates that the Row Level Security (RLS) policies on the `domain-csv-files` bucket do not grant the currently authenticated user (`test@example.com`) the necessary `SELECT` permission to list files.

        b.  **API Permission Error:**
            *   **Error Message:** `PATCH /api/domains/84856/has-files 403 Forbidden` accompanied by server log `[API HasFiles Update] Forbidden attempt by non-admin: test@example.com`.
            *   **Context:** This error occurred after the (failing) storage operation, when the frontend tried to update the domain's `has_files` status by calling the API endpoint.
            *   **Code Analysis (`src/app/api/domains/[id]/has-files/route.ts`):** Review of this API route confirmed it explicitly checks if the requesting user has the `admin` role in their `user_metadata` or if their email matches the `ADMIN_EMAIL` environment variable. Since `test@example.com` is not an admin, the API correctly returned a 403 Forbidden.

3.  **Storage RLS Policy Investigation:**
    *   We examined the intended RLS policies defined in `setup-storage.sql`. This script defines policies for `INSERT` (allowing authenticated uploads) and `SELECT` (allowing admins to read all, and other users to read files based on a `domains.storage_url` check).
    *   The `StorageApiError` confirmed these policies were either not applied or the `SELECT` policy conditions were not met for the user.

4.  **Attempting to Apply RLS Policies (`setup-storage.sql`):**
    *   Running the `setup-storage.sql` script via the Supabase SQL Editor failed with the error:
        ```
        ERROR:  0A000: extension "storage" is not available
        DETAIL:  Could not open extension control file "/usr/lib/postgresql/share/postgresql/extension/storage.control": No such file or directory.
        HINT:  The extension must first be installed on the system where PostgreSQL is running.
        ```

5.  **Investigating the Missing `storage` Extension:**
    *   Checking the "Database -> Extensions" section in the Supabase dashboard showed that the `storage` extension was not listed as available.
    *   Running `CREATE EXTENSION IF NOT EXISTS "storage" SCHEMA "storage";` directly in the SQL Editor also failed with the same error.
    *   **Conclusion:** The fundamental PostgreSQL `storage` extension, required for Supabase Storage functionality, is not installed or available on the database server for this specific Supabase project.

## Current Status & Blockers

*   **Primary Blocker:** The application cannot use Supabase Storage (listing, uploading files) because the required `storage` PostgreSQL extension is unavailable for the project. This needs to be resolved at the Supabase infrastructure level, likely by **contacting Supabase support** or further investigating the project's specific configuration.
*   **Secondary Issue:** The `/api/domains/[id]/has-files` API route currently requires admin privileges. This causes a `403 Forbidden` error for non-admin users after an upload attempt. This can be fixed by modifying the API route's permission logic, but it won't make uploads functional until the primary storage extension issue is resolved.

## Next Steps Recommended

1.  **Contact Supabase Support:** Report the missing `storage` extension issue for the project.
2.  **Once Storage Extension is Fixed:** Run the `setup-storage.sql` script via the Supabase SQL Editor to create the bucket (if needed) and apply the correct RLS policies.
3.  **(Optional, while waiting):** Modify the permission check in `/api/domains/[id]/has-files/route.ts` if non-admins should be allowed to update the `has_files` status.
4.  **Retest CSV Upload:** After the storage extension and RLS policies are correctly configured, test the CSV upload functionality again.