"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminIndexPage() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  
  // Redirect to dashboard or handle non-admin access
  useEffect(() => {
    // Check for user authentication first
    if (!user) {
      // If not authenticated, redirect to login
      router.push("/login?redirect=/admin");
      return;
    }
    
    // Check for admin status
    if (isAdmin) {
      // Redirect admin to dashboard with a slight delay to avoid flashing
      const timer = setTimeout(() => {
        router.push("/admin/dashboard");
      }, 500);
      return () => clearTimeout(timer);
    } else {
      // Redirect non-admin users to the regular application
      router.push("/domains");
    }
  }, [user, isAdmin, router]);

  // Show appropriate state while redirecting
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      {!user ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin mb-4" />
          <p className="text-muted-foreground">Checking credentials...</p>
        </>
      ) : !isAdmin ? (
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>
            You don't have admin privileges. Redirecting to user dashboard...
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Loader2 className="h-8 w-8 animate-spin mb-4" />
          <p className="text-muted-foreground">Redirecting to admin dashboard...</p>
        </>
      )}
    </div>
  );
}
