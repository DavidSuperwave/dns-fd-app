"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { LucideLayoutDashboard, LucideSettings } from "lucide-react";

export function PanelSwitcher() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  
  // Only show to admin users
  if (!isAdmin) return null;
  
  const isAdminPath = pathname.startsWith("/admin");
  const userPath = "/domains"; // Default user panel route
  const adminPath = "/admin/dashboard"; // Default admin panel route
  
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-background border shadow-lg rounded-full p-1 flex items-center">
        {isAdminPath ? (
          <Button
            size="sm"
            variant="ghost"
            asChild
            className="rounded-full gap-2"
          >
            <Link href={userPath}>
              <LucideLayoutDashboard size={16} />
              <span className="sr-only sm:not-sr-only sm:inline-block">
                Switch to User Panel
              </span>
            </Link>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            asChild
            className="rounded-full gap-2"
          >
            <Link href={adminPath}>
              <LucideSettings size={16} />
              <span className="sr-only sm:not-sr-only sm:inline-block">
                Switch to Admin Panel
              </span>
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
