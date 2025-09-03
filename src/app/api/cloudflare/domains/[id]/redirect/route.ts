import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-client'; // Import the admin client
// DELETE handler for deleting a domain
interface PageRuleAction {
    id: string;
    value: { url?: string; status_code?: number; } | string | null; // Simplified, add other action types if needed
}
interface PageRule {
    id: string; // Page Rule ID
    targets: any[];
    actions: PageRuleAction[];
    status: string; // 'active' or 'disabled'
    priority: number;
    // ... other PageRule properties
}
const CLOUDFLARE_API_URL = 'https://api.cloudflare.com/client/v4';
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabaseDomainId = (await params).id;
    // const resolvedCookieStore = cookies();
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
    let domainNameForLogging = `DB ID ${supabaseDomainId}`;

    try {
        // 1. Authenticate and Authorize User
        const { data: { user: requestingUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !requestingUser) {
            console.warn(`[API Edit Redirect] Auth failed for domain ${supabaseDomainId}:`, authError?.message);
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        // --- End Authentication ---

        // Ensure admin client is available (needed for checks and Cloudflare operations)
        if (!supabaseAdmin) {
            console.error('[API Edit Redirect] Supabase admin client not initialized.');
            return NextResponse.json({ error: 'Server configuration error: Admin client unavailable.' }, { status: 500 });
        }

        // --- Authorization Step 2: Check Permissions (Admin or Assigned User) ---
        let isAuthorizedToEdit = false;
        const isAdmin = requestingUser?.email === 'admin@superwave.io' || requestingUser?.user_metadata?.role === 'admin';

        if (isAdmin) {
            console.log(`[API Edit Redirect] Admin user ${requestingUser.email} authorized for domain ${supabaseDomainId}.`);
            isAuthorizedToEdit = true;
        } else {
            // Non-admin: check if the user is assigned to this specific domain
            console.log(`[API Edit Redirect] Non-admin user ${requestingUser.email}. Checking assignment for domain ${supabaseDomainId}...`);
            const { count, error: assignmentCheckError } = await supabaseAdmin
                .from('domain_assignments')
                .select('id', { count: 'exact', head: true })
                .eq('domain_id', supabaseDomainId)
                .eq('user_email', requestingUser.email);

            if (assignmentCheckError) {
                console.error(`[API Edit Redirect] Database error checking assignment for user ${requestingUser.id} and domain ${supabaseDomainId}:`, assignmentCheckError);
                return NextResponse.json({ error: 'Database error checking permissions.' }, { status: 500 });
            }

            if (count && count > 0) {
                console.log(`[API Edit Redirect] User ${requestingUser.email} is assigned to domain ${supabaseDomainId}. Authorized.`);
                isAuthorizedToEdit = true;
            } else {
                console.warn(`[API Edit Redirect] Forbidden attempt by user ${requestingUser.email} to edit redirect for unassigned domain ${supabaseDomainId}.`);
                // isAuthorizedToEdit remains false
            }
        }

        if (!isAuthorizedToEdit) {
            return NextResponse.json({ error: 'Forbidden: You do not have permission to edit this domain\'s redirect.' }, { status: 403 });
        }
        // --- End Authorization ---

        const { newRedirectUrl } = await request.json();

        // Fetch domain details from Supabase
        console.log(`[API Edit Redirect] User ${requestingUser.email} attempting to update redirect for Supabase domain ID: ${supabaseDomainId}`);
        const { data: domainData, error: fetchDomainError } = await supabaseAdmin
            .from('domains')
            .select('cloudflare_id, name, redirect_url')
            .eq('id', supabaseDomainId)
            .single();

        if (fetchDomainError || !domainData) {
            console.error(`[API Edit Redirect] Error fetching domain ${supabaseDomainId} from DB:`, fetchDomainError);
            return NextResponse.json({ error: `Domain not found or DB error: ${fetchDomainError?.message}` }, { status: 404 });
        }

        domainNameForLogging = domainData.name || domainNameForLogging;
        const cfZoneId = domainData.cloudflare_id;

        if (!cfZoneId) {
            console.error(`[API Edit Redirect] Cloudflare ID not found for domain ${domainNameForLogging}. Cannot update redirect.`);
            return NextResponse.json({ error: 'Cloudflare ID missing for this domain.' }, { status: 400 });
        }

        const cfToken = process.env.CLOUDFLARE_API_TOKEN;
        if (!cfToken) {
            console.error('[API Edit Redirect] CLOUDFLARE_API_TOKEN is not set.');
            return NextResponse.json({ error: 'Server configuration error: Cloudflare token missing.' }, { status: 500 });
        }

        // Manage Cloudflare Page Rules
        console.log(`[API Edit Redirect] Fetching page rules for zone ${cfZoneId} (${domainNameForLogging})`);
        const listRulesResponse = await fetch(`${CLOUDFLARE_API_URL}/zones/${cfZoneId}/pagerules?status=active&match=all&order=priority`, {
            headers: { 'Authorization': `Bearer ${cfToken}`, 'Content-Type': 'application/json' }
        });

        if (!listRulesResponse.ok) {
            const errorData = await listRulesResponse.json().catch(() => ({}));
            console.error(`[API Edit Redirect] Failed to list page rules for ${cfZoneId}:`, errorData);
            throw new Error(`Cloudflare API error listing page rules: ${errorData.errors?.[0]?.message || listRulesResponse.statusText}`);
        }
        const listRulesResult = await listRulesResponse.json();
        const existingRules: PageRule[] = listRulesResult.result || [];
        const existingForwardingRule = existingRules.find(rule =>
            rule.actions.some(action => action.id === 'forwarding_url') && rule.status === 'active'
        );

        let cloudflareActionTaken = "none";

        if (newRedirectUrl && typeof newRedirectUrl === 'string' && newRedirectUrl.trim() !== "") {
            const redirectPayloadAction = { id: 'forwarding_url', value: { url: newRedirectUrl.trim(), status_code: 301 } };
            const pageRulePayload = {
                targets: [{ target: 'url', constraint: { operator: 'matches', value: `*${domainData.name}/*` } }],
                actions: [redirectPayloadAction],
                priority: 1,
                status: 'active'
            };

            if (existingForwardingRule) {
                console.log(`[API Edit Redirect] Updating existing page rule ${existingForwardingRule.id} for ${domainNameForLogging} to ${newRedirectUrl}`);
                const updateResponse = await fetch(`${CLOUDFLARE_API_URL}/zones/${cfZoneId}/pagerules/${existingForwardingRule.id}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...pageRulePayload, priority: existingForwardingRule.priority })
                });
                if (!updateResponse.ok) {
                    const errorData = await updateResponse.json().catch(() => ({}));
                    throw new Error(`Cloudflare API error updating page rule: ${errorData.errors?.[0]?.message || updateResponse.statusText}`);
                }
                cloudflareActionTaken = "updated";
            } else {
                console.log(`[API Edit Redirect] Creating new page rule for ${domainNameForLogging} to ${newRedirectUrl}`);
                const createResponse = await fetch(`${CLOUDFLARE_API_URL}/zones/${cfZoneId}/pagerules`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(pageRulePayload)
                });
                if (!createResponse.ok) {
                    const errorData = await createResponse.json().catch(() => ({}));
                    throw new Error(`Cloudflare API error creating page rule: ${errorData.errors?.[0]?.message || createResponse.statusText}`);
                }
                cloudflareActionTaken = "created";
            }
        } else { // Remove redirect
            if (existingForwardingRule) {
                console.log(`[API Edit Redirect] Deleting existing page rule ${existingForwardingRule.id} for ${domainNameForLogging}`);
                const deleteResponse = await fetch(`${CLOUDFLARE_API_URL}/zones/${cfZoneId}/pagerules/${existingForwardingRule.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${cfToken}` }
                });
                if (!deleteResponse.ok && deleteResponse.status !== 404) {
                    const errorData = await deleteResponse.json().catch(() => ({}));
                    throw new Error(`Cloudflare API error deleting page rule: ${errorData.errors?.[0]?.message || deleteResponse.statusText}`);
                } else if (deleteResponse.status === 404) {
                    console.log(`[API Edit Redirect] Page rule ${existingForwardingRule.id} already deleted from Cloudflare.`);
                }
                cloudflareActionTaken = "deleted";
            } else {
                cloudflareActionTaken = "none (no rule to delete)";
            }
        }

        // Update Supabase
        const finalRedirectUrlToSave = (newRedirectUrl && typeof newRedirectUrl === 'string' && newRedirectUrl.trim() !== "") ? newRedirectUrl.trim() : null;
        const updateTimestamp = new Date().toISOString();

        const { error: updateDbError } = await supabaseAdmin
            .from('domains')
            .update({
                redirect_url: finalRedirectUrlToSave,
                redirect_url_last_updated: updateTimestamp,
                last_synced: updateTimestamp
            })
            .eq('id', supabaseDomainId);

        if (updateDbError) {
            console.error(`[API Edit Redirect] Error updating redirect in DB for ${domainNameForLogging}:`, updateDbError);
            return NextResponse.json({
                error: `Cloudflare redirect updated (${cloudflareActionTaken}), but failed to update database: ${updateDbError.message}`
            }, { status: 500 });
        }

        console.log(`[API Edit Redirect] Successfully updated redirect for ${domainNameForLogging}. CF Action: ${cloudflareActionTaken}. DB Redirect: ${finalRedirectUrlToSave}`);
        return NextResponse.json({
            success: true,
            message: `Redirect for '${domainNameForLogging}' updated successfully. Cloudflare action: ${cloudflareActionTaken}.`
        }, { status: 200 });

    } catch (error) {
        console.error(`[API Edit Redirect] General Error for domain ${domainNameForLogging}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}