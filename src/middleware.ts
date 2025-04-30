import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase-client'; // Import the admin client

// Function to create Supabase client within middleware/server components
const createClient = (request: NextRequest) => {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          try {
            let cookieValue = request.cookies.get(name)?.value;
            // console.log(`[Middleware] Cookie ${name}: ${cookieValue}`); // Let Supabase handle potential prefixes
            return cookieValue ?? null;
          } catch (error) {
            console.error('Error getting cookie:', error);
            return null;
          }
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.set({
              name,
              value,
              ...options,
            });
          } catch (error) {
            console.error('Error setting cookie:', error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.set({
              name,
              value: '',
              ...options,
            });
          } catch (error) {
            console.error('Error removing cookie:', error);
          }
        },
      },
    }
  );

  return { supabase, response };
};

export async function middleware(request: NextRequest) {
  const { supabase, response } = createClient(request);
  const { pathname } = request.nextUrl;

  // Get current session
  console.log(`[Middleware] Checking session for path: ${pathname}`);
  const {
    data: { session },
    error: sessionError // Capture potential error during getSession
  } = await supabase.auth.getSession();

  let userIsActive = false; // Default to inactive

  if (sessionError) {
    console.error(`[Middleware] Error getting session for ${pathname}:`, sessionError);
    // Treat session error as potentially inactive/unauthenticated
  } else if (session?.user) {
    console.log(`[Middleware] Session found for user ${session.user.id}. Checking profile status...`);
    // If session exists, check the user_profiles table for active status
    try {
      // Use supabaseAdmin to bypass RLS for this check
      if (!supabaseAdmin) {
          console.error('[Middleware] Supabase admin client is not available for profile check.');
          // Keep userIsActive false if admin client fails
      } else {
          const { data: profile, error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .select('active')
            .eq('id', session.user.id)
            .single(); // Use single() as profile should be unique

          if (profileError) {
            console.error(`[Middleware] Error fetching profile for user ${session.user.id}:`, profileError);
            // Treat profile fetch error as inactive
          } else if (profile && profile.active === true) {
            console.log(`[Middleware] User ${session.user.id} profile is active.`);
            userIsActive = true;
          } else {
            console.warn(`[Middleware] User ${session.user.id} profile not found or is inactive (active: ${profile?.active}).`);
          }
      } // End of the 'else' block for supabaseAdmin check
    } catch (e) { // Catch block for the try starting above
        console.error(`[Middleware] Exception fetching profile for user ${session.user.id}:`, e);
    }
  } else { // Else block for 'if (session?.user)'
    console.log(`[Middleware] No active session found for path: ${pathname}`);
  }

  // Define paths that require authentication
  const authenticatedPaths = [
    '/domains',
    '/settings',
    '/users',
    '/dns-records',
  ];

  // Define public paths that don't require authentication
  const publicPaths = [
    '/login', 
    '/signup', 
    '/forgot-password',
    '/forgot-password/confirm',
    '/auth/callback',
    '/reset-password',
    '/reset-password/confirm'
  ]; // Add any other public paths

  // Handle manual path redirection
  if (pathname === '/manual') {
    return NextResponse.redirect(new URL('/api/manual', request.url));
  }

  // Special handling for password reset confirm page
  if (pathname.startsWith('/forgot-password/confirm')) {
    console.log(`[Middleware] Bypassing auth checks for password reset: ${pathname}`);
    return response;
  }

  // --- Authentication Logic ---
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  const requiresAuth = authenticatedPaths.some(path => pathname.startsWith(path)) || pathname === '/'; // Protect root path too

  // If trying to access a protected route WITHOUT a valid session OR an active profile, redirect to login
  if (requiresAuth && !userIsActive) {
    console.log(`[Middleware] Access denied (requiresAuth=${requiresAuth}, userIsActive=${userIsActive}). Redirecting from ${pathname} to /login`);
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If trying to access a public route (like login/signup) WITH an active session/profile, redirect to domains
  if (isPublicPath && userIsActive) {
    console.log(`[Middleware] Active session/profile & isPublicPath=true, redirecting from ${pathname} to /domains`);
    return NextResponse.redirect(new URL('/domains', request.url));
  }

  // Allow the request to proceed for all other cases
  console.log(`[Middleware] Allowing request to proceed for path: ${pathname} (userIsActive: ${userIsActive})`);
  return response; // Use the response object created by createClient
}

// Configure the middleware matcher
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - *.png, *.svg etc. (other static assets)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};