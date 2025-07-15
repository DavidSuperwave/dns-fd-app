"use client";

import React, { useEffect, createContext, useState, useContext } from "react";
import Link from "next/link";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { usePathname, useRouter } from "next/navigation";
import LogoutButton from "../auth/logout-button";
import { useAuth } from "../auth/auth-provider";
import { ScanStatusIndicator } from "../scan/scan-status-indicator";
// Removed unused Clock import

// Create a scan context to share scan state across components
interface ScanContextType {
  scanInProgress: boolean;
  setScanInProgress: React.Dispatch<React.SetStateAction<boolean>>;
  scanProgress: { current: number; total: number };
  setScanProgress: React.Dispatch<React.SetStateAction<{ current: number; total: number }>>;
}

export const ScanContext = createContext<ScanContextType>({
  scanInProgress: false,
  setScanInProgress: () => {},
  scanProgress: { current: 0, total: 0 },
  setScanProgress: () => {},
});

// Hook to use scan context
export const useScanContext = () => useContext(ScanContext);

interface NavItemProps {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  icon?: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

function NavItem({ href, children, active, icon, className, onClick }: NavItemProps) {
  const { scanInProgress } = useScanContext();
  const router = useRouter();
  
  // Handle navigation with warning if scan is in progress
  const handleNavigation = (e: React.MouseEvent) => {
    // Only intercept navigation if a scan is in progress
    if (scanInProgress) {
      e.preventDefault();
      
      // Show confirmation dialog
      const confirmed = window.confirm(
        "A domain scan is currently in progress. Navigating away will interrupt the scan. Continue anyway?"
      );
      
      // If confirmed, proceed with navigation
      if (confirmed) {
        router.push(href);
      }
    }
    // If no scan in progress, let the Link handle navigation normally
  };

  return (
    <Link
      href={href}
      onClick={onClick || handleNavigation}
      className={`flex items-center px-3 py-2 text-sm rounded-md ${
        active
          ? "bg-primary/10 text-primary"
          : className || "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {children}
      {scanInProgress && href !== "/domains" && (
        <span className="ml-1 w-1.5 h-1.5 rounded-full bg-yellow-500" title="Scan in progress"></span>
      )}
    </Link>
  );
}

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const { user, isAdmin, refreshSession } = useAuth();
  
  // Initialize scan state for the context
  const [scanInProgress, setScanInProgress] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  
  // Get first letter of email for avatar fallback
  const userInitial = user?.email ? user.email[0].toUpperCase() : '?';
  
  // On mount, check if we need to refresh session
  useEffect(() => {
    // Only refresh session once on initial page load
    // The static variable prevents refreshing on each component re-render
    if (!window.__initialAuthRefreshDone) {
      const updateAuthState = async () => {
        console.log('[DashboardLayout] Initial auth state check');
        await refreshSession(false); // Don't force refresh to avoid rate limits
        console.log('[DashboardLayout] Auth state checked, admin status:', { isAdmin });
        window.__initialAuthRefreshDone = true;
      };
      
      updateAuthState();
    }
  }, [refreshSession, isAdmin]);

  // Create scan context value
  const scanContextValue = {
    scanInProgress,
    setScanInProgress,
    scanProgress,
    setScanProgress
  };

  return (
    <ScanContext.Provider value={scanContextValue}>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-10 w-full border-b bg-background">
          <div className="container flex h-16 items-center justify-between px-4 md:px-6 max-w-[1400px] mx-auto">
            <div className="flex items-center">
              <Link href="/domains" className="flex items-center gap-2 mr-6">
                <Image
                  src="/logo.png"
                  alt="Superwave"
                  width={120}
                  height={24}
                  className="h-6 w-auto"
                />
                {scanInProgress && (
                  <span className="ml-2 h-2 w-2 rounded-full bg-yellow-500 animate-pulse"
                        title={`Scan in progress: ${scanProgress.current}/${scanProgress.total}`}></span>
                )}
              </Link>
              <nav className="hidden md:flex items-center gap-6 ml-2">
              <NavItem href="/domains" active={pathname === "/domains"}>
                Domains
              </NavItem>
              {isAdmin && (
                <>
                  <NavItem href="/users" active={pathname === "/users"}>
                    Users
                  </NavItem>
                  <NavItem
                    href="/cron-monitor"
                    active={pathname === "/cron-monitor"}
                  >
                    Cron Monitor
                  </NavItem>
                  <NavItem
                    href="/tenants"
                    active={pathname === "/tenants"}
                  >
                    Tenants
                  </NavItem>
                </>
              )}
              <NavItem href="/settings" active={pathname === "/settings"}>
                Settings
              </NavItem>
              <NavItem
                href="/manual"
                className="text-[#4e1ddc] hover:bg-[#4e1ddc]/10"
                onClick={(e) => {
                  e.preventDefault();
                  // Open manual in new tab, will be proxied through our API
                  window.open('/api/manual', '_blank', 'noopener,noreferrer');
                }}
              >
                Manual
              </NavItem>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            {scanInProgress && (
              <div className="text-xs text-muted-foreground flex items-center">
                <div className="h-2 w-2 animate-pulse bg-yellow-500 rounded-full mr-1"></div>
                <span>Scanning: {Math.round(scanProgress.current/scanProgress.total*100)}%</span>
              </div>
            )}
            <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
              {user?.email || 'Guest'}
            </div>
            <div className="flex items-center space-x-2">
              <LogoutButton />
              <Avatar className="h-8 w-8">
                <AvatarImage src="" alt={user?.email || 'User'} />
                <AvatarFallback>{userInitial}</AvatarFallback>
              </Avatar>
            </div>
          </div>
          </div>
        </header>
      <main className="flex-1 container mx-auto w-full max-w-[1400px] px-4 md:px-6">
        {children}
      </main>
      
      {/* Render the scan status indicator - will only be visible during scans */}
      <ScanStatusIndicator />
    </div>
    </ScanContext.Provider>
  );
}
