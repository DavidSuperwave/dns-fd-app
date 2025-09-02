"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import LogoutButton from "../auth/logout-button";
import { useAuth } from "../auth/auth-provider";
import { PanelSwitcher } from "./panel-switcher";

// Admin navigation item component
interface AdminNavItemProps {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  icon?: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

function AdminNavItem({ 
  href, 
  children, 
  active, 
  icon, 
  className, 
  onClick 
}: AdminNavItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center px-4 py-3 text-sm rounded-md ${
        active
          ? "bg-primary text-primary-foreground"
          : className || "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </Link>
  );
}

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  
  // Redirect non-admin users
  React.useEffect(() => {
    if (user && !isAdmin) {
      router.push("/domains");
    }
  }, [user, isAdmin, router]);
  
  // Get first letter of email for avatar fallback
  const userInitial = user?.email ? user.email[0].toUpperCase() : '?';
  
  if (!user || !isAdmin) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="flex min-h-screen">
      {/* Admin sidebar - sticky */}
      <aside className="hidden lg:flex flex-col w-64 border-r bg-background sticky top-0 h-screen overflow-y-auto">
        <div className="p-4 border-b">
          <Link href="/admin" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Superwave"
              width={120}
              height={24}
              className="h-6 w-auto"
            />
            <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
              Admin
            </span>
          </Link>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <AdminNavItem 
            href="/admin/dashboard" 
            active={pathname === "/admin/dashboard"}
          >
            Dashboard
          </AdminNavItem>
          
          <AdminNavItem 
            href="/admin/users" 
            active={pathname === "/admin/users"}
          >
            Users
          </AdminNavItem>
          
          <AdminNavItem 
            href="/admin/companies" 
            active={pathname === "/admin/companies"}
          >
            Companies
          </AdminNavItem>
          
          <AdminNavItem 
            href="/admin/domains" 
            active={pathname === "/admin/domains"}
          >
            Domain Administration
          </AdminNavItem>
          
          <AdminNavItem 
            href="/admin/community" 
            active={pathname === "/admin/community"}
          >
            Community
          </AdminNavItem>
          
          <AdminNavItem 
            href="/admin/tenants" 
            active={pathname === "/admin/tenants"}
          >
            Tenants
          </AdminNavItem>
          
          <AdminNavItem 
            href="/admin/sales" 
            active={pathname === "/admin/sales"}
          >
            Sales Stats
          </AdminNavItem>
          
          <AdminNavItem 
            href="/admin/settings" 
            active={pathname === "/admin/settings"}
          >
            Admin Settings
          </AdminNavItem>

          <hr className="my-4" />
          
          <AdminNavItem 
            href="/domains" 
            className="text-blue-600 hover:bg-blue-50"
          >
            Return to User App
          </AdminNavItem>
        </nav>
        
        <div className="p-4 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src="" alt={user?.email || 'Admin'} />
                <AvatarFallback>{userInitial}</AvatarFallback>
              </Avatar>
              <div className="text-sm">
                <div className="font-medium">{user?.email}</div>
                <div className="text-xs text-muted-foreground">Administrator</div>
              </div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>
      
      {/* Main content area - scrollable */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Top header for mobile */}
        <header className="lg:hidden sticky top-0 z-10 w-full border-b bg-background">
          <div className="flex h-16 items-center justify-between px-4">
            <Link href="/admin" className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="Superwave"
                width={120}
                height={24}
                className="h-6 w-auto"
              />
              <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                Admin
              </span>
            </Link>
            
            <div className="flex items-center space-x-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src="" alt={user?.email || 'Admin'} />
                <AvatarFallback>{userInitial}</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>
        
        {/* Main content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
      
      {/* Panel switcher */}
      <PanelSwitcher />
    </div>
  );
}
