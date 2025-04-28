import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

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
            const cookies = request.cookies;
            const cookie = cookies.get(name);
            return cookie?.value ?? null;
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

  if (sessionError) {
    console.error(`[Middleware] Error getting session for ${pathname}:`, sessionError);
    // Allow request to proceed but log error, maybe return error response?
    // For now, let's just log and continue to see if it causes the ISE later
  } else {
    console.log(`[Middleware] Session found for ${pathname}:`, !!session);
  }

  // Define public paths that don't require authentication
  const publicPaths = ['/login', '/signup', '/forgot-password', '/auth/callback']; // Add any other public paths

  // Define authenticated paths
  // Adjust this list based on your application structure
  const authenticatedPaths = ['/domains', '/settings', '/users', '/dns-records']; 

  // --- Manual Path Handling ---
  if (pathname === '/manual') {
    // Redirect to the API proxy for GitBook content
    return NextResponse.redirect(new URL('/api/manual', request.url));
  }

  // --- Authentication Logic ---
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  const requiresAuth = authenticatedPaths.some(path => pathname.startsWith(path)) || pathname === '/'; // Protect root path too

  // If trying to access a protected route without a session, redirect to login
  if (requiresAuth && !session) {
    console.log(`[Middleware] No session & requiresAuth=true, redirecting from ${pathname} to /login`);
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If trying to access a public route (like login/signup) with an active session AND no session error, redirect to domains
  if (isPublicPath && session && !sessionError) {
     console.log(`[Middleware] Active session & no error & isPublicPath=true, redirecting from ${pathname} to /domains`);
     return NextResponse.redirect(new URL('/domains', request.url));
  }

  // Allow the request to proceed for all other cases
  // (e.g., accessing public paths without session, accessing protected paths with session, API routes)
  console.log(`[Middleware] Allowing request to proceed for path: ${pathname}`);
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