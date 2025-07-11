import "./globals.css";
import type { Metadata } from "next";
import { cookies } from 'next/headers';
// Import createServerClient directly from @supabase/ssr
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { AuthProvider } from "../components/auth/auth-provider";
import { Toaster } from "@/components/ui/sonner"

export const dynamic = 'force-dynamic'; // Ensure layout is dynamic for session checking

export const metadata: Metadata = {
  title: "Superwave",
  description: "Manage DNS records and domains",
  icons: {
    icon: '/favicon.png'
  }
};

export default async function RootLayout({ // Make layout async
  children,
}: {
  children: React.ReactNode;
}) {
  // Await the cookies() call to get the actual store
  const cookieStore = await cookies(); // Create cookie store instance

  // Create Supabase server client directly in the layout
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Define async cookie handlers inline
        async get(name: string) {
          // Explicitly await the get call on the store
          const cookie = await cookieStore.get(name);
          return cookie?.value;
        },
        async set(name: string, value: string, options: CookieOptions) {
          try {
            await cookieStore.set({ name, value, ...options });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
            console.warn(`[RootLayout] Ignored error setting cookie '${name}' in Server Component:`, error);
          }
        },
        async remove(name: string, options: CookieOptions) {
          try {
            await cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
             console.warn(`[RootLayout] Ignored error removing cookie '${name}' in Server Component:`, error);
          }
        },
      },
    }
  );

  // Fetch session using the directly created client
  const { data: { session } } = await supabase.auth.getSession();

  // Pass the initial session to the AuthProvider
  return (
    <html lang="en">
      <body suppressHydrationWarning={true}> {/* Add suppressHydrationWarning */}
        <AuthProvider initialSession={session}>
          {children}
        </AuthProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}