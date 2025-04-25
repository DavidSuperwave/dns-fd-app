"use client";

import { Toaster } from "sonner";
import AuthWrapper from "../auth/auth-wrapper";

export default function RootWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthWrapper>
      {children}
      <Toaster position="top-right" />
    </AuthWrapper>
  );
}