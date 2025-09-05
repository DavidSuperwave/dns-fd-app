"use client";

import React, { useEffect, createContext, useState, useContext } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import LogoutButton from "../auth/logout-button";
import { useAuth } from "../auth/auth-provider";
import { ScanStatusIndicator } from "../scan/scan-status-indicator";
import { Sidebar } from "./sidebar";

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


interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
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
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <Sidebar isAdmin={isAdmin} />
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Header */}
          <header className="flex-shrink-0 border-b bg-background z-10">
            <div className="flex h-16 items-center justify-between px-6">
              {/* Scan Status */}
              <div className="flex items-center">
                {scanInProgress && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <div className="h-2 w-2 animate-pulse bg-yellow-500 rounded-full mr-2"></div>
                    <span>Scanning: {Math.round(scanProgress.current/scanProgress.total*100)}%</span>
                  </div>
                )}
              </div>
              
              {/* User Info */}
              <div className="flex items-center space-x-4">
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
          
          {/* Page Content - Scrollable */}
          <main className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
            {children}
          </main>
        </div>
      </div>
      
      {/* Render the scan status indicator - will only be visible during scans */}
      <ScanStatusIndicator />
    </ScanContext.Provider>
  );
}
