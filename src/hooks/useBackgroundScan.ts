"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { performBackgroundScan } from '../lib/background-scan';
import { useLatestScan } from './useLatestScan';
import { createClient } from '../lib/supabase-client'; // Import createClient
import { ProgressTracker, ScanResult } from '../types/scan';
import { RealtimePostgresInsertPayload } from "@supabase/supabase-js";

const DEBUG_PREFIX = '[BackgroundScan Hook]';

interface ScanState {
  inProgress: boolean;
  progress: ProgressTracker;
  error: string | null;
  totalDomains: number;
  nonActiveDomains: number;
  statusBreakdown: Record<string, number>;
}

export function useBackgroundScan() {
  const supabase = createClient(); // Create client instance
  // Use a single state object to prevent race conditions
  const [scanState, setScanState] = useState<ScanState>({
    inProgress: false,
    progress: {
      current: 0,
      total: 0,
      percentage: 0,
      startTime: Date.now()
    },
    error: null,
    totalDomains: 0,
    nonActiveDomains: 0,
    statusBreakdown: {}
  });

  // Use refs to track component lifecycle and prevent race conditions
  const isMounted = useRef(true);
  const scanInProgressRef = useRef(false);
  const lastProgressRef = useRef({
    percentage: 0,
    timestamp: Date.now()
  });

  const { 
    latestScan,
    refresh: refreshLatestScan
  } = useLatestScan();

  // Debug logging for state changes
  useEffect(() => {
    console.log(`${DEBUG_PREFIX} State updated:`, {
      scanState,
      lastProgress: lastProgressRef.current,
      isMounted: isMounted.current,
      scanInProgress: scanInProgressRef.current
    });
  }, [scanState]);

  // Subscribe to real-time scan updates
  useEffect(() => {
    console.log(`${DEBUG_PREFIX} Setting up Supabase subscription`);
    
    const subscription = supabase
      .channel('scan_progress')
      .on('postgres_changes' as any, { // Cast to any as workaround for TS error
        event: '*',
        schema: 'public',
        table: 'scan_results'
      }, (payload: RealtimePostgresInsertPayload<ScanResult>) => {
        console.log(`${DEBUG_PREFIX} Received Supabase update:`, payload);
        
        if (!isMounted.current) {
          console.log(`${DEBUG_PREFIX} Component unmounted, ignoring update`);
          return;
        }

        const scan = payload.new as ScanResult;
        
        // Handle different scan states
        if (scan.status === 'running') {
          if (scan.scan_result?.progress) {
            const progress = scan.scan_result.progress;
            console.log(`${DEBUG_PREFIX} Updating progress:`, progress);
            
            setScanState(prev => ({
              ...prev,
              inProgress: true,
              progress,
              totalDomains: scan.total_domains,
              nonActiveDomains: scan.domains_needing_attention,
              statusBreakdown: scan.status_breakdown || {}
            }));
            
            scanInProgressRef.current = true;
            lastProgressRef.current = {
              percentage: progress.percentage,
              timestamp: Date.now()
            };
          }
        } else if (scan.status === 'completed') {
          console.log(`${DEBUG_PREFIX} Scan completed`);
          
          // Keep progress visible briefly before resetting
          setTimeout(() => {
            if (isMounted.current) {
              setScanState(prev => ({
                ...prev,
                inProgress: false,
                progress: {
                  ...prev.progress,
                  percentage: 100
                }
              }));
              scanInProgressRef.current = false;
              refreshLatestScan();
            }
          }, 3000);
        } else if (scan.status === 'failed') {
          console.error(`${DEBUG_PREFIX} Scan failed:`, scan.scan_result?.error);
          setScanState(prev => ({
            ...prev,
            inProgress: false,
            error: scan.scan_result?.error || 'Unknown error'
          }));
          scanInProgressRef.current = false;
        }
      })
      .subscribe();

    return () => {
      console.log(`${DEBUG_PREFIX} Cleaning up subscription`);
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, [refreshLatestScan]);

  // Load initial state from latest scan
  useEffect(() => {
    if (latestScan) {
      console.log(`${DEBUG_PREFIX} Loading initial state:`, latestScan);
      
      setScanState(prev => ({
        ...prev,
        totalDomains: latestScan.total_domains,
        nonActiveDomains: latestScan.domains_needing_attention,
        statusBreakdown: latestScan.status_breakdown || {}
      }));

      if (latestScan.status === 'running' && latestScan.scan_result?.progress) {
        const progress = latestScan.scan_result.progress;
        setScanState(prev => ({
          ...prev,
          inProgress: true,
          progress
        }));
        scanInProgressRef.current = true;
      }
    }
  }, [latestScan]);

  // Start a background scan
  const startScan = useCallback(async (perPage: number = 50) => {
    console.log(`${DEBUG_PREFIX} Starting scan:`, { perPage });
    
    if (scanInProgressRef.current) {
      console.warn(`${DEBUG_PREFIX} Scan already in progress`);
      return;
    }

    try {
      setScanState(prev => ({
        ...prev,
        error: null,
        inProgress: true,
        progress: {
          current: 0,
          total: 0,
          percentage: 0,
          startTime: Date.now()
        }
      }));
      scanInProgressRef.current = true;
      
      console.log(`${DEBUG_PREFIX} Starting background domain scan...`);
      const result = await performBackgroundScan(perPage);
      
      if (result) {
        console.log(`${DEBUG_PREFIX} Scan completed successfully:`, result);
        setScanState(prev => ({
          ...prev,
          totalDomains: result.totalDomains,
          nonActiveDomains: result.nonActiveDomains.length,
          statusBreakdown: result.statusBreakdown
        }));
        refreshLatestScan();
      }
    } catch (error) {
      console.error(`${DEBUG_PREFIX} Error starting scan:`, error);
      setScanState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start scan',
        inProgress: false
      }));
      scanInProgressRef.current = false;
    }
  }, [refreshLatestScan]);

  // Cancel the current scan
  const cancelScan = useCallback(() => {
    console.log(`${DEBUG_PREFIX} Cancelling scan`);
    
    setScanState(prev => ({
      ...prev,
      inProgress: false,
      progress: {
        current: 0,
        total: 0,
        percentage: 0,
        startTime: Date.now()
      }
    }));
    scanInProgressRef.current = false;
  }, []);

  return {
    scanInProgress: scanState.inProgress,
    scanProgress: scanState.progress,
    progressPercentage: scanState.progress.percentage,
    error: scanState.error,
    startScan,
    cancelScan,
    totalDomains: scanState.totalDomains,
    nonActiveDomains: scanState.nonActiveDomains,
    statusBreakdown: scanState.statusBreakdown
  };
}