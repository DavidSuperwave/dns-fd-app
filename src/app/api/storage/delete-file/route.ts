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
          try { resolvedCookieStore.set({ name, value, ...options }) } catch (error) { console.warn(`[API Delete File] Failed set cookie`, error) }
        },
        remove(name: string, options: CookieOptions) {
          try { resolvedCookieStore.set({ name, value: '', ...options }) } catch (error) { console.warn(`[API Delete File] Failed remove cookie`, error) }
        },
      },
    }
  );

  try {
    // 1. Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.warn('[API Delete File] Authentication failed.', authError);
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
      // Basic path validation (prevent directory traversal, ensure it's domainId/filename format)
      const pathParts = filePath.split('/');
      if (filePath.includes('..') || pathParts.length !== 2 || !pathParts[0] || !pathParts[1]) {
         console.warn(`[API Delete File] Invalid filePath format requested by ${user.email}: ${filePath}`);
         return NextResponse.json({ error: 'Invalid filePath format.' }, { status: 400 });
      }
      // Optional: Add check if user is assigned to the domainId in pathParts[0] if needed
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
    }

    // 3. Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      console.error('[API Delete File] Supabase admin client is not initialized.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    console.log(`[API Delete File] User ${user.email} attempting to delete file: ${filePath}`);

    // 4. Delete the file using admin client
    const { error: deleteError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove([filePath]); // Pass filePath in an array

    if (deleteError) {
      // Handle cases like file not found gracefully if needed
      if (deleteError.message.includes('Not Found')) {
         console.warn(`[API Delete File] File not found during delete attempt: ${filePath}`);
         // Decide if this should be a success or error to the client
         // Returning success might be okay if the goal is "file is gone"
         return NextResponse.json({ success: true, message: 'File not found, considered deleted.' }, { status: 200 });
      }
      console.error(`[API Delete File] Error deleting file ${filePath}:`, deleteError);
      return NextResponse.json({ error: `Failed to delete file: ${deleteError.message}` }, { status: 500 });
    }

    console.log(`[API Delete File] Successfully deleted file: ${filePath}`);

    // 5. Return success response
    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('[API Delete File] General Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}