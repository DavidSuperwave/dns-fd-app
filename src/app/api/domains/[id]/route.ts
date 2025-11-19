// src/app/api/domains/[id]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-client'; // Import the admin client
// Assuming a Cloudflare API client/wrapper exists or we use fetch directly
// import { deleteCloudflareZone } from '@/lib/cloudflare-api'; // Example import

export const dynamic = 'force-dynamic';

// DELETE handler for deleting a domain
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const domainIdToDelete = (await params).id; // This is likely the Supabase UUID, not the domain name
    const resolvedCookieStore = await cookies();

    // Create Supabase client for auth check
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) { return resolvedCookieStore.get(name)?.value },
                set(name: string, value: string, options: CookieOptions) {
                    try { resolvedCookieStore.set({ name, value, ...options }) } catch (error) { console.warn(`[API Domain Delete] Failed set cookie`, error) }
                },
                remove(name: string, options: CookieOptions) {
                    try { resolvedCookieStore.set({ name, value: '', ...options }) } catch (error) { console.warn(`[API Domain Delete] Failed remove cookie`, error) }
                },
            },
        }
    );

    let cloudflareDeletionSuccessful = false;
    let cloudflareSkipped = false;
    let cloudflareErrorMessage = '';
    let domainNameForLogging = `ID ${domainIdToDelete}`; // Fallback name
    let cfZoneIdForLogging: string | null = null; // To store CF ID for logging
    let userEmailForLogging: string | null = null; // To store user email for logging

    try {
        // --- Authorization Step 1: Authenticate User ---
        console.log(`[API Domain Delete] Checking auth for request to delete ID: ${domainIdToDelete}`);
        const { data: { user: requestingUser }, error: authError } = await supabase.auth.getUser();

        if (authError) {
            console.warn('[API Domain Delete] Auth error checking user:', authError.message);
            return NextResponse.json({ error: `Authentication error: ${authError.message}` }, { status: 401 });
        }
        if (!requestingUser) {
            console.warn('[API Domain Delete] No authenticated user found.');
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        userEmailForLogging = requestingUser.email ?? null; // Store for logging
        // --- End Authentication ---

        // Ensure admin client is available (needed for checks and deletions)
        if (!supabaseAdmin) {
            console.error('[API Domain Delete] Supabase admin client is not initialized.');
            // Log deletion attempt if user was identified
            if (userEmailForLogging) {
                await logDeletionAttempt(
                    domainNameForLogging, // Might still be ID at this stage
                    cfZoneIdForLogging,
                    userEmailForLogging,
                    `Deletion failed: Supabase admin client not initialized. Domain ID: ${domainIdToDelete}`
                );
            }
            return NextResponse.json({ error: 'Server configuration error: Admin client unavailable.' }, { status: 500 });
        }

        // --- Authorization Step 2: Check Permissions (Admin or Assigned User) ---
        let isAuthorizedToDelete = false;
        const isAdmin = requestingUser?.user_metadata?.role === 'admin' || (process.env.ADMIN_EMAIL && requestingUser?.email === process.env.ADMIN_EMAIL);

        if (isAdmin) {
            console.log(`[API Domain Delete] Admin user ${requestingUser.email} authorized.`);
            isAuthorizedToDelete = true;
        } else {
            console.log(`[API Domain Delete] Non-admin user ${requestingUser.email}. Checking assignment for domain ${domainIdToDelete}...`);
            const { count, error: assignmentCheckError } = await supabaseAdmin
                .from('domain_assignments')
                .select('id', { count: 'exact', head: true })
                .eq('domain_id', domainIdToDelete)
                .eq('user_email', requestingUser.email);

            if (assignmentCheckError) {
                console.error(`[API Domain Delete] Database error checking assignment for user ${requestingUser.id} and domain ${domainIdToDelete}:`, assignmentCheckError);
                await logDeletionAttempt(
                    domainNameForLogging,
                    cfZoneIdForLogging,
                    userEmailForLogging,
                    `Deletion failed: Database error checking permissions. Domain ID: ${domainIdToDelete}. Error: ${assignmentCheckError.message}`
                );
                return NextResponse.json({ error: 'Database error checking permissions.' }, { status: 500 });
            }
            if (count && count > 0) {
                console.log(`[API Domain Delete] User ${requestingUser.email} is assigned to domain ${domainIdToDelete}. Authorized.`);
                isAuthorizedToDelete = true;
            } else {
                console.warn(`[API Domain Delete] Forbidden attempt by user ${requestingUser.email} to delete unassigned domain ${domainIdToDelete}.`);
            }
        }

        if (!isAuthorizedToDelete) {
            await logDeletionAttempt(
                domainNameForLogging, // Might still be ID if not fetched yet
                cfZoneIdForLogging,
                userEmailForLogging,
                `Deletion forbidden: User ${userEmailForLogging} does not have permission for domain ID ${domainIdToDelete}.`
            );
            return NextResponse.json({ error: 'Forbidden: You do not have permission to delete this domain.' }, { status: 403 });
        }
        // --- End Authorization ---

        console.log(`[API Domain Delete] User ${requestingUser.email} starting deletion for domain ID: ${domainIdToDelete}`);

        const { data: domainData, error: fetchError } = await supabaseAdmin
            .from('domains')
            .select('cloudflare_id, name')
            .eq('id', domainIdToDelete)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') { // Not found
                console.warn(`[API Domain Delete] Domain ID ${domainIdToDelete} not found in database during deletion process. Assuming already deleted.`);
                await logDeletionEvent( // Log that it was "not found" by an authorized user
                    `ID ${domainIdToDelete} (Not Found)`,
                    null,
                    userEmailForLogging!,
                    new Date().toISOString(),
                    `Domain ID ${domainIdToDelete} not found, presumed already deleted.`
                );
                return NextResponse.json({ success: true, message: `Domain already deleted or not found.` }, { status: 200 });
            }
            console.error(`[API Domain Delete] Error fetching domain details for ${domainIdToDelete}:`, fetchError);
            await logDeletionAttempt(
                domainNameForLogging,
                cfZoneIdForLogging,
                userEmailForLogging!,
                `Deletion failed: Error fetching domain details for ${domainIdToDelete}. Error: ${fetchError.message}`
            );
            throw new Error(`Database error fetching domain details: ${fetchError.message}`);
        }
        if (!domainData) {
            console.warn(`[API Domain Delete] Domain ID ${domainIdToDelete} not found in database (post-fetch check).`);
            await logDeletionEvent( // Log that it was "not found"
                `ID ${domainIdToDelete} (Not Found)`,
                null,
                userEmailForLogging!,
                new Date().toISOString(),
                `Domain ID ${domainIdToDelete} not found (post-fetch check).`
            );
            return NextResponse.json({ success: true, message: `Domain not found.` }, { status: 200 });
        }

        cfZoneIdForLogging = domainData.cloudflare_id; // Update with actual CF ID
        domainNameForLogging = domainData.name || domainNameForLogging; // Update with actual domain name

        // Cloudflare deletion is disabled - always skip
        cloudflareSkipped = true;
        console.log(`[API Domain Delete] Cloudflare deletion skipped (integration disabled) for domain ${domainNameForLogging}.`);

        // Delete related data (assignments)
        console.log(`[API Domain Delete] Deleting assignments for domain ID ${domainIdToDelete}.`);
        const { error: assignmentError } = await supabaseAdmin
            .from('domain_assignments')
            .delete()
            .eq('domain_id', domainIdToDelete);
        if (assignmentError) console.error(`[API Domain Delete] Error deleting assignments for ${domainIdToDelete}:`, assignmentError);
        else console.log(`[API Domain Delete] Successfully deleted assignments for domain ID ${domainIdToDelete}.`);

        // Delete main domain record
        console.log(`[API Domain Delete] Deleting main record for domain ID ${domainIdToDelete}.`);
        const { data: deletedData, error: dbDeleteError } = await supabaseAdmin
            .from('domains')
            .delete()
            .eq('id', domainIdToDelete)
            .select() // Select to confirm deletion, can be removed if not needed
            .single(); // Expecting one row to be deleted

        const timestamp = new Date().toISOString();
        let supabaseRecordActuallyDeleted = false;

        if (dbDeleteError) {
            // Even if DB delete fails, log the attempt by an authorized user
            console.error(`[API Domain Delete] Database deletion failed for domain ID ${domainIdToDelete}: ${dbDeleteError.message}`);
            // finalMessage will be constructed later to reflect this
            // throw new Error(`Database deletion failed: ${dbDeleteError.message}`); // We will log and then throw
        } else if (!deletedData) {
            // This case means the record was not found by the delete query,
            // possibly deleted between the fetch and delete, or ID was wrong despite fetch success (unlikely with UUIDs).
            console.warn(`[API Domain Delete] Main domain record ${domainIdToDelete} was not found during delete. It might have already been deleted.`);
            // supabaseRecordActuallyDeleted remains false, but we treat it as "already gone" for the message.
        } else {
            console.log(`[API Domain Delete] Successfully deleted domain ID ${domainIdToDelete} from database.`);
            supabaseRecordActuallyDeleted = true;
        }


        // Determine final message
        let finalMessage = `Domain '${domainNameForLogging}' deletion processed.`;
        if (supabaseRecordActuallyDeleted) {
            finalMessage = `Domain '${domainNameForLogging}' deleted successfully from the platform.`;
        } else if (dbDeleteError) {
            finalMessage = `Domain '${domainNameForLogging}' failed to delete from platform database: ${dbDeleteError.message}.`;
        } else { // Did not find record to delete
            finalMessage = `Domain '${domainNameForLogging}' was not found in platform database for deletion.`;
        }

        if (cloudflareSkipped) finalMessage += ` Cloudflare deletion skipped ${cloudflareErrorMessage ? `(${cloudflareErrorMessage})` : '(no CF ID, token missing, or zone already gone)'}.`;
        else if (cloudflareDeletionSuccessful) finalMessage += ` Also deleted from Cloudflare.`;
        else finalMessage += ` Cloudflare deletion failed or was not attempted successfully: ${cloudflareErrorMessage || 'No further details'}.`;

        if (assignmentError) finalMessage += ` Warning: Failed to delete domain assignments (${assignmentError.message}).`;


        // --- ADD LOGGING TO 'domain_deletion_logs' TABLE ---
        await logDeletionEvent(
            domainNameForLogging,
            cfZoneIdForLogging,
            userEmailForLogging!, // Should be set if we reached here
            timestamp,
            finalMessage,
            supabaseRecordActuallyDeleted,
            cloudflareDeletionSuccessful,
            cloudflareSkipped
        );
        // --- END LOGGING ---

        if (dbDeleteError) { // If main DB delete failed, this should be the primary error
            // We've logged the attempt, now return the error to the client
            return NextResponse.json({ error: `Database deletion failed: ${dbDeleteError.message}. Details: ${finalMessage}` }, { status: 500 });
        }

        return NextResponse.json({ success: supabaseRecordActuallyDeleted, status: 200 });

    } catch (error) {
        console.error(`[API Domain Delete] General Error for ID ${domainIdToDelete}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';

        // Log general error attempts too
        await logDeletionAttempt(
            domainNameForLogging, // This might be just the ID if fetch failed
            cfZoneIdForLogging, // Might be null
            userEmailForLogging, // Might be null if auth check failed very early
            `General error during deletion process for domain ID ${domainIdToDelete}: ${errorMessage}`
        );

        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}


// Helper function to log deletion events/attempts
async function logDeletionEvent(
    domainName: string,
    cloudflareId: string | null,
    userEmail: string,
    timestamp: string,
    details: string,
    supabaseDeleted?: boolean,
    cfDeleted?: boolean,
    cfSkipped?: boolean
) {
    if (!supabaseAdmin) {
        console.error('[API Domain Delete Log] Supabase admin client not available for logging.');
        return;
    }
    if (!userEmail) {
        console.warn('[API Domain Delete Log] No user email available for logging event for domain:', domainName);
        // Optionally, log with a placeholder or skip
        // return;
    }

    const logEntry = {
        domain_name: domainName,
        cloudflare_id: cloudflareId,
        deleted_by_email: userEmail || 'unknown_early_failure',
        deleted_at: timestamp,
        details: details, // You can expand this to be more structured if needed
        // Optional extra fields you might add to your log table:
        // supabase_record_deleted: supabaseDeleted,
        // cloudflare_deletion_successful: cfDeleted,
        // cloudflare_skipped: cfSkipped,
    };

    try {
        const { error: logError } = await supabaseAdmin
            .from('domain_deletion_logs') // YOUR LOG TABLE NAME
            .insert(logEntry);

        if (logError) {
            console.error(`[API Domain Delete Log] Failed to log deletion for domain ${domainName}:`, logError);
        } else {
            console.log(`[API Domain Delete Log] Successfully logged deletion for domain ${domainName} by ${userEmail}.`);
        }
    } catch (e) {
        console.error(`[API Domain Delete Log] Exception during logging for domain ${domainName}:`, e);
    }
}

// Simplified logger for attempts that fail before full data is gathered
async function logDeletionAttempt(
    domainIdentifier: string, // Could be name or ID
    cloudflareId: string | null,
    userEmail: string | null,
    reason: string
) {
    await logDeletionEvent(
        domainIdentifier,
        cloudflareId,
        userEmail || 'unknown_or_unauthenticated',
        new Date().toISOString(),
        `Deletion Attempt Failed: ${reason}`
    );
}