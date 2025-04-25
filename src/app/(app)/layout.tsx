"use client";

import { Inter } from "next/font/google";
import RootWrapper from "../../components/layout/root-wrapper";

// Import Inter font
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <link 
          rel="stylesheet" 
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" 
        />
      </head>
      <body className="font-sans">
        <RootWrapper>
          {children}
        </RootWrapper>
      </body>
    </html>
  );
}