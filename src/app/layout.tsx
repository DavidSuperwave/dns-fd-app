import "./globals.css";
import type { Metadata } from "next";
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'; // Use server component client
import { AuthProvider } from "../components/auth/auth-provider";

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
  const cookieStore = cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });
  const { data: { session } } = await supabase.auth.getSession();

  // Pass the initial session to the AuthProvider
  return (
    <html lang="en">
      <body>
        <AuthProvider initialSession={session}>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}