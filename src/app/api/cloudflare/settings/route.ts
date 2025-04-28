import { NextResponse } from 'next/server';
  // Keep the ssr version for App Router
  import { createServerClient, type CookieOptions } from '@supabase/ssr';
  import { cookies } from 'next/headers';

  // Save Cloudflare API settings
export async function POST(request: Request) {
  try {
    // Keep the ssr version for App Router
    // Create Supabase client for POST handler
    const resolvedCookieStore = await cookies(); // Call await cookies() once here
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { // Remove async
            try {
              return resolvedCookieStore.get(name)?.value;
            } catch (error) {
               console.error(`Error getting cookie "${name}":`, error);
               return undefined;
            }
          },
          set(name: string, value: string, options: CookieOptions) { // Remove async
            try {
              resolvedCookieStore.set({ name, value, ...options });
            } catch (error) {
              console.warn(`createServerClient set cookie error (ignorable if middleware exists): ${error}`);
            }
          },
          remove(name: string, options: CookieOptions) { // Remove async
            try {
              resolvedCookieStore.set({ name, value: '', ...options });
            } catch (error) {
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
      console.log('[Cloudflare API Settings] Auth check failed:', {
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

    // Get settings from request body
    const { email, apiToken, accountId } = await request.json();

    if (!email || !apiToken || !accountId) {
      return NextResponse.json(
        { success: false, error: 'Email, API token, and account ID are required' },
        { status: 400 }
      );
    }

    console.log(`[Cloudflare API] Saving settings for account ID ${accountId}`);

    // First, store in platform-wide settings
    // In a real implementation, this would be stored in a dedicated "settings" table in your database
    // For this example, we'll create a special "system_settings" record in Supabase storage
    
    // For demonstration purposes, let's store the settings in the current admin user's metadata
    // In production, you'd want a better storage mechanism
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        cloudflare_settings: {
          email,
          apiToken,
          accountId,
          updated_at: new Date().toISOString(),
        }
      }
    });

    if (updateError) {
      console.error('[Cloudflare API] Error saving settings:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to save settings' },
        { status: 500 }
      );
    }

    // Also update the environment files for the API routes
    // We need to create or update environment variables for the server
    // This is a simplified implementation - in production, you might store these
    // in a more secure way, such as using a secrets manager

    // Also update our hardcoded credentials in the API routes
    // This would be done via server-side configuration in a real implementation
    // We're demonstrating the concept here, but this approach is not secure
    // for a production environment
    
    console.log(`[Cloudflare API] Settings saved successfully`);
    
    return NextResponse.json({
      success: true,
      message: 'Cloudflare API settings saved successfully'
    });
  } catch (error) {
    console.error('[Cloudflare API] Error saving settings:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      },
      { status: 500 }
    );
  }
}

// Get current Cloudflare API settings
export async function GET() {
  try {
    // Keep the ssr version for App Router
    // Create Supabase client for GET handler
    const resolvedCookieStore = await cookies(); // Call await cookies() once here
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { // Remove async
            try {
              return resolvedCookieStore.get(name)?.value;
            } catch (error) {
               console.error(`Error getting cookie "${name}":`, error);
               return undefined;
            }
          },
          set(name: string, value: string, options: CookieOptions) { // Remove async
            try {
              resolvedCookieStore.set({ name, value, ...options });
            } catch (error) {
              console.warn(`createServerClient set cookie error (ignorable if middleware exists): ${error}`);
            }
          },
          remove(name: string, options: CookieOptions) { // Remove async
            try {
              resolvedCookieStore.set({ name, value: '', ...options });
            } catch (error) {
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
      console.log('[Cloudflare API Settings] GET Auth check failed:', {
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

    // Get settings from user metadata (in a real app, you'd get this from a dedicated settings table)
    const cloudflareSettings = userData.user.user_metadata?.cloudflare_settings;

    // If no settings found, return defaults
    if (!cloudflareSettings) {
      return NextResponse.json({
        success: true,
        settings: {
          email: 'dns@superwave.ai',
          accountId: '4dc0ca4b102ca90ce263dbec31af4a1f',
          apiToken: '' // Don't return a token if none is set
        }
      });
    }

    // Return the settings (but mask the API token for security)
    return NextResponse.json({
      success: true,
      settings: {
        email: cloudflareSettings.email,
        accountId: cloudflareSettings.accountId,
        apiToken: cloudflareSettings.apiToken ? '********' : '', // Mask the token in the response
        updated_at: cloudflareSettings.updated_at
      }
    });
  } catch (error) {
    console.error('[Cloudflare API] Error retrieving settings:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      },
      { status: 500 }
    );
  }
}