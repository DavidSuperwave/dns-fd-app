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
  { params }: { params: { id: string } }
) {
  const domainIdToDelete = params.id; // This is likely the Supabase UUID, not the domain name
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

  try {
    // 1. Verify requesting user is authenticated and is an admin
    const { data: { user: requestingUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !requestingUser) {
      console.warn('[API Domain Delete] Authentication failed.', authError);
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const isAdmin = requestingUser?.user_metadata?.role === 'admin' || requestingUser?.email === process.env.ADMIN_EMAIL;
    if (!isAdmin) {
      console.warn(`[API Domain Delete] Forbidden attempt by non-admin: ${requestingUser.email}`);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      console.error('[API Domain Delete] Supabase admin client is not initialized.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    console.log(`[API Domain Delete] Admin ${requestingUser.email} attempting to delete domain ID: ${domainIdToDelete}`);

    // --- TODO: Add Cloudflare Deletion Logic ---
    // Need to fetch the domain name or Cloudflare Zone ID associated with domainIdToDelete first
    // Then call the appropriate Cloudflare API endpoint (e.g., DELETE /zones/:zone_identifier)
    // Example:
    // const { data: domainData, error: fetchError } = await supabaseAdmin.from('domains').select('name, cloudflare_zone_id').eq('id', domainIdToDelete).single();
    // if (fetchError || !domainData) { /* Handle error */ }
    // const cfZoneId = domainData.cloudflare_zone_id;
    // if (cfZoneId) {
    //   const cfResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${cfZoneId}`, {
    //      method: 'DELETE',
    //      headers: { /* Auth Headers */ }
    //   });
    //   if (!cfResponse.ok) { /* Handle Cloudflare error, maybe don't proceed? */ }
    // } else { console.warn(`[API Domain Delete] No Cloudflare Zone ID found for domain ID ${domainIdToDelete}. Skipping Cloudflare deletion.`); }
    // --- End Cloudflare Logic Placeholder ---

    // 2. Delete domain from Supabase 'domains' table
    const { error: dbDeleteError } = await supabaseAdmin
      .from('domains')
      .delete()
      .eq('id', domainIdToDelete); // Use the Supabase ID

    if (dbDeleteError) {
      console.error(`[API Domain Delete] Error deleting domain ${domainIdToDelete} from DB:`, dbDeleteError);
      return NextResponse.json({ error: `Database deletion failed: ${dbDeleteError.message}` }, { status: 500 });
    }

    console.log(`[API Domain Delete] Successfully deleted domain ID ${domainIdToDelete} from database.`);

    // --- TODO: Delete related data? ---
    // Consider deleting related records like scan_results, domain_assignments etc.
    // This might be better handled by database cascade deletes if set up.
    // Example:
    // await supabaseAdmin.from('domain_assignments').delete().eq('domain_id', domainIdToDelete);
    // --- End Related Data Placeholder ---


    // 3. Return success response
    return NextResponse.json({ success: true, message: `Domain ${domainIdToDelete} deleted successfully.` }, { status: 200 });

  } catch (error) {
    console.error('[API Domain Delete] General Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}