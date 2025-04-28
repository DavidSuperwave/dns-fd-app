// src/app/api/storage/signed-url/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-client';

export const dynamic = 'force-dynamic';

const BUCKET_NAME = 'domain-csv-files'; // Define bucket name

export async function POST(request: NextRequest) {
  const resolvedCookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return resolvedCookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          try { resolvedCookieStore.set({ name, value, ...options }) } catch (error) { console.warn(`[API Signed URL] Failed set cookie`, error) }
        },
        remove(name: string, options: CookieOptions) {
          try { resolvedCookieStore.set({ name, value: '', ...options }) } catch (error) { console.warn(`[API Signed URL] Failed remove cookie`, error) }
        },
      },
    }
  );

  try {
    // 1. Verify user authentication (Assuming any authenticated user can get a URL for upload)
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.warn('[API Signed URL] Authentication failed.', authError);
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // 2. Get filePath from request body
    let filePath: string | null = null;
    try {
      const body = await request.json();
      filePath = body.filePath;
      if (!filePath || typeof filePath !== 'string') {
        return NextResponse.json({ error: 'Invalid request body: "filePath" must be a non-empty string.' }, { status: 400 });
      }
      // Basic path validation (prevent directory traversal, ensure it's within expected structure)
      if (filePath.includes('..') || !filePath.startsWith(`${user.id}/`)) { // Ensure path starts with user's ID
         console.warn(`[API Signed URL] Invalid filePath requested by ${user.email}: ${filePath}`);
         return NextResponse.json({ error: 'Invalid filePath.' }, { status: 400 });
      }
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
    }

    // 3. Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      console.error('[API Signed URL] Supabase admin client is not initialized.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    console.log(`[API Signed URL] User ${user.email} requesting signed upload URL for path: ${filePath}`);

    // 4. Generate signed UPLOAD URL using admin client
    // The second argument is an options object, e.g., for upsert behavior.
    // Expiry is typically handled by Supabase defaults for upload URLs.
    const { data, error: signedUrlError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(filePath, { upsert: false }); // Pass options object instead of expiresIn

    if (signedUrlError) {
      console.error(`[API Signed URL] Error generating signed upload URL for ${filePath}:`, signedUrlError);
      return NextResponse.json({ error: `Failed to generate signed URL: ${signedUrlError.message}` }, { status: 500 });
    }

    if (!data) {
       console.error(`[API Signed URL] No data returned from createSignedUploadUrl for ${filePath}`);
       return NextResponse.json({ error: 'Failed to generate signed URL (no data returned).' }, { status: 500 });
    }

    console.log(`[API Signed URL] Successfully generated signed upload URL for ${filePath}`);

    // 5. Return the signed URL data (includes URL and token)
    // The actual URL is in data.signedUrl, the full path in data.path, and the token in data.token
    return NextResponse.json({ success: true, signedUrl: data.signedUrl, path: data.path, token: data.token }, { status: 200 });

  } catch (error) {
    console.error('[API Signed URL] General Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}