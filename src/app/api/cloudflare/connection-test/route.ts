import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Test connection to Cloudflare API with provided credentials
export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
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