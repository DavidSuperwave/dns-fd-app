import "./globals.css";
import type { Metadata } from "next";
import { cookies } from 'next/headers';
import { createServerClientWrapper } from "../lib/supabase-client"; // Use our SSR wrapper again
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
  const cookieStore = cookies(); // Create cookie store instance

  // Use the wrapper function to create the server client
  const supabase = createServerClientWrapper(cookieStore);
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