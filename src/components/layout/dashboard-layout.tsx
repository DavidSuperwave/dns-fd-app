"use client";

import React from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { usePathname } from "next/navigation";

interface NavItemProps {
  href: string;
  children: React.ReactNode;
  active?: boolean;
}

function NavItem({ href, children, active }: NavItemProps) {
  return (
    <Link 
      href={href} 
      className={`flex items-center px-3 py-2 text-sm rounded-md ${
        active 
          ? "bg-primary/10 text-primary" 
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 w-full border-b bg-background">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg">
              DNS-FD
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <NavItem href="/dashboard" active={pathname === "/dashboard"}>
                Dashboard
              </NavItem>
              <NavItem href="/domains" active={pathname === "/domains"}>
                Domains
              </NavItem>
              <NavItem href="/users" active={pathname === "/users"}>
                Users
              </NavItem>
              <NavItem href="/settings" active={pathname === "/settings"}>
                Settings
              </NavItem>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Avatar className="h-8 w-8">
              <AvatarImage src="" alt="User" />
              <AvatarFallback>N</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto w-full max-w-[1400px]">
        {children}
      </main>
    </div>
  );
}
