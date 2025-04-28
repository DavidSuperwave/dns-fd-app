import { NextResponse } from 'next/server';
  // Keep the ssr version for App Router
  import { createServerClient, type CookieOptions } from '@supabase/ssr';
  import { cookies } from 'next/headers';

  // Test connection to Cloudflare API with provided credentials
export async function POST(request: Request) {
  try {
    // Keep the ssr version for App Router
    // Create a Supabase client configured for server-side Route Handler
    const resolvedCookieStore = await cookies(); // Call await cookies() once here
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { // Remove async
            try {
              // Use the resolved store
              return resolvedCookieStore.get(name)?.value;
            } catch (error) {
               console.error(`Error getting cookie "${name}":`, error);
               return undefined; // Return undefined on error
            }
          },
          set(name: string, value: string, options: CookieOptions) { // Remove async
            try {
              // Use the resolved store
              resolvedCookieStore.set({ name, value, ...options });
            } catch (error) {
              // The `set` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
              console.warn(`createServerClient set cookie error (ignorable if middleware exists): ${error}`);
            }
          },
          remove(name: string, options: CookieOptions) { // Remove async
            try {
              // Use the resolved store
              resolvedCookieStore.set({ name, value: '', ...options });
            } catch (error) {
              // The `delete` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
              console.warn(`createServerClient remove cookie error (ignorable if middleware exists): ${error}`);
            }
          },
        },
      }
    );
    // Verify user is authenticated and has admin role
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get user data to check role
    const { data: userData } = await supabase.auth.getUser();
    
    // Check admin status - consider both role and email
    const isAdminEmail = userData.user?.email === 'management@superwave.ai';
    const hasAdminRole = userData.user?.user_metadata?.role === 'admin';
    const isAdmin = isAdminEmail || hasAdminRole;
    
    if (!userData.user || !isAdmin) {
      console.log('[Cloudflare API Connection Test] Auth check failed:', {
        email: userData.user?.email,
        role: userData.user?.user_metadata?.role,
        isAdminEmail,
        hasAdminRole
      });
      
      return NextResponse.json(
        { success: false, error: 'Not authorized. Admin role required.' },
        { status: 403 }
      );
    }

    // Get credentials from request body
    const { email, apiToken, accountId } = await request.json();

    if (!email || !apiToken || !accountId) {
      return NextResponse.json(
        { success: false, error: 'Email, API token, and account ID are required' },
        { status: 400 }
      );
    }

    // Define Cloudflare API URL for account zones endpoint
    const cloudflareApiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/zones`;
    
    // Set up headers with API Token authentication
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken.trim()}`
    };

    // Make a test request to Cloudflare API
    console.log(`[Cloudflare API] Testing connection with email=${email} and account ID=${accountId}`);
    
    const response = await fetch(`${cloudflareApiUrl}?per_page=1`, {
      method: 'GET',
      headers: headers
    });
    
    // Parse response
    const data = await response.json();
    
    // Check if connection was successful
    if (!response.ok || !data.success) {
      console.error('[Cloudflare API] Connection test failed:', data.errors || response.statusText);
      
      // Extract detailed error message if available
      let errorMessage = 'Connection failed';
      if (data.errors && data.errors.length > 0) {
        errorMessage = `${data.errors[0].message} (Code: ${data.errors[0].code})`;
      }
      
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 400 }
      );
    }
    
    console.log('[Cloudflare API] Connection test successful');
    
    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Connection successful'
    });
  } catch (error) {
    console.error('[Cloudflare API] Error testing connection:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
}