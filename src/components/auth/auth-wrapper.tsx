"use client";

import { AuthProvider } from "./auth-provider";

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}