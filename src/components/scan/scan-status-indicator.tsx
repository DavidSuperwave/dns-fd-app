"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useBackgroundScan } from '../../hooks/useBackgroundScan';
import { Progress } from '../../components/ui/progress';
// Removed unused Button import
import { XCircle } from 'lucide-react';
import { toast } from 'sonner';

const DEBUG_PREFIX = '[ScanStatusIndicator]';

export function ScanStatusIndicator() {
  const { 
    scanInProgress, 
    progressPercentage, 
    scanProgress,
    error,
    cancelScan 
  } = useBackgroundScan();
  
  const [isMinimized, setIsMinimized] = useState(false);
  const [lastProgress, setLastProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Debug logging
  useEffect(() => {
    console.log(`${DEBUG_PREFIX} State update:`, {
      scanInProgress,
      progressPercentage,
      scanProgress,
      error,
      isMinimized,
      isVisible
    });
  }, [scanInProgress, progressPercentage, scanProgress, error, isMinimized, isVisible]);

  // Handle visibility based on scan state
  useEffect(() => {
    if (scanInProgress) {
      console.log(`${DEBUG_PREFIX} Scan started, showing indicator`);
      setIsVisible(true);
      // Clear any existing hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    } else if (progressPercentage === 100) {
      console.log(`${DEBUG_PREFIX} Scan completed, scheduling hide`);
      // Keep visible for 3 seconds after completion
      hideTimeoutRef.current = setTimeout(() => {
        console.log(`${DEBUG_PREFIX} Hiding completed scan indicator`);
        setIsVisible(false);
      }, 3000);
    }

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [scanInProgress, progressPercentage]);

  // Track progress changes
  useEffect(() => {
    if (progressPercentage > lastProgress) {
      console.log(`${DEBUG_PREFIX} Progress increased:`, {
        from: lastProgress,
        to: progressPercentage,
        change: progressPercentage - lastProgress
      });
      setLastProgress(progressPercentage);
    }
  }, [progressPercentage, lastProgress]);

  // --- Define Callbacks Before Conditional Returns ---

  // Calculate estimated time remaining
  const calculateTimeRemaining = useCallback(() => {
    if (!scanProgress?.startTime || !scanProgress?.current) {
      console.log(`${DEBUG_PREFIX} Calculating time: No progress yet`);
      return 'Calculating...';
    }
    
    const elapsed = Date.now() - scanProgress.startTime;
    const percentComplete = scanProgress.current / scanProgress.total;
    
    if (percentComplete === 0) {
      console.log(`${DEBUG_PREFIX} Calculating time: No progress percentage`);
      return 'Calculating...';
    }
    
    const estimatedTotal = elapsed / percentComplete;
    const remaining = estimatedTotal - elapsed;
    
    let timeString = '';
    if (remaining < 60000) {
      timeString = 'Less than a minute';
    } else if (remaining < 3600000) {
      timeString = `~${Math.ceil(remaining / 60000)} minutes`;
    } else {
      timeString = `~${Math.ceil(remaining / 3600000)} hours`;
    }

    console.log(`${DEBUG_PREFIX} Time estimate:`, {
      elapsed,
      percentComplete,
      estimatedTotal,
      remaining,
      timeString
    });

    return timeString;
  }, [scanProgress]);

  // Handle cancel button click
  const handleCancel = useCallback(() => {
    if (error) return; // Don't allow cancellation in error state
    
    console.log(`${DEBUG_PREFIX} Cancel clicked`);
    
    const confirmed = window.confirm(
      "Are you sure you want to cancel the background scan? Progress will be lost."
    );
    
    if (confirmed) {
      console.log(`${DEBUG_PREFIX} Cancel confirmed`);
      cancelScan();
      toast.info("Background scan cancelled");
      // Hide the indicator after cancellation
      setIsVisible(false);
    }
  }, [cancelScan, error, setIsVisible]); // Note: Added setIsVisible dependency

  // --- Conditional Rendering Logic ---

  // Don't render if not visible
  if (!isVisible) {
    console.log(`${DEBUG_PREFIX} Component hidden`);
    return null;
  }

  // Show error state if there's an error
  if (error) {
    console.error(`${DEBUG_PREFIX} Error state:`, error);
    return (
      <div className="fixed bottom-4 right-4 w-72 bg-destructive/10 text-destructive rounded-lg shadow-lg p-3 z-50 border border-destructive">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse"></span>
            Scan Error
          </div>
          <button 
            onClick={() => {
              cancelScan();
              setIsVisible(false);
            }}
            className="text-destructive/70 hover:text-destructive p-1 rounded-sm"
            title="Dismiss"
          >
            <XCircle size={14} />
          </button>
        </div>
        <div className="text-xs">{error}</div>
      </div>
    );
  }

  // If minimized, show a small floating button
  if (isMinimized) {
    console.log(`${DEBUG_PREFIX} Rendering minimized view:`, {
      progressPercentage
    });
    return (
      <div 
        className="fixed bottom-4 right-4 bg-primary/10 rounded-full p-2 cursor-pointer z-50 shadow-md hover:bg-primary/20 transition-all duration-150"
        onClick={() => setIsMinimized(false)}
        title={`Scan in progress: ${progressPercentage}%`}
      >
        <div className="relative">
          <div className="h-10 w-10 rounded-full flex items-center justify-center bg-secondary/20">
            <span className="text-xs font-medium">{progressPercentage}%</span>
          </div>
          <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-yellow-500 animate-pulse"></div>
        </div>
      </div>
    );
  }

  // Full indicator
  console.log(`${DEBUG_PREFIX} Rendering full view:`, {
    scanProgress,
    progressPercentage
  });

  const statusText = scanInProgress ? "Scan in Progress" : "Scan Complete";
  const statusColor = scanInProgress ? "bg-yellow-500" : "bg-green-500";

  return (
    <div className="fixed bottom-4 right-4 w-72 bg-card rounded-lg shadow-lg p-3 z-50 border border-border">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${statusColor} ${scanInProgress ? 'animate-pulse' : ''}`}></span>
          {statusText}
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => {
              console.log(`${DEBUG_PREFIX} Minimize clicked`);
              setIsMinimized(true);
            }}
            className="text-muted-foreground hover:text-foreground p-1 rounded-sm"
            title="Minimize"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3" />
              <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
              <path d="M3 16h3a2 2 0 0 1 2 2v3" />
              <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
          </button>
          {scanInProgress && (
            <button 
              onClick={handleCancel}
              className="text-muted-foreground hover:text-destructive p-1 rounded-sm"
              title="Cancel scan"
            >
              <XCircle size={14} />
            </button>
          )}
        </div>
      </div>
      
      <div className="mb-2">
        <Progress value={progressPercentage} className="h-2" />
      </div>
      
      <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
        <div>Progress:</div>
        <div className="text-right font-medium">{scanProgress.current} / {scanProgress.total}</div>
        
        <div>Completion:</div>
        <div className="text-right font-medium">{progressPercentage}%</div>
        
        {scanInProgress && (
          <>
            <div>Remaining:</div>
            <div className="text-right font-medium">{calculateTimeRemaining()}</div>
          </>
        )}
      </div>
      
      <div className="mt-2 text-xs text-muted-foreground">
        {scanInProgress 
          ? "You can continue using the app while scanning runs in the background."
          : "Scan completed successfully."}
      </div>
    </div>
  );
}