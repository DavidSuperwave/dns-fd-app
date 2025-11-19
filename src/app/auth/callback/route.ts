import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');

    if (code) {
        const cookieStore = cookies();
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

        // Exchange the code for a session
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            console.error('[Auth Callback] Error exchanging code:', error);
            return NextResponse.redirect(new URL('/login?error=auth_failed', requestUrl.origin));
        }

        // Redirect to password setup page
        return NextResponse.redirect(new URL('/setup-password', requestUrl.origin));
    }

    // If no code, redirect to login
    return NextResponse.redirect(new URL('/login', requestUrl.origin));
}
