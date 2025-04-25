"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase-client';
import { ScanResult } from '../types/scan';

// Configuration constants
const RETRY_DELAY = 5000; // 5 seconds
const MAX_RETRIES = 3;
const POLL_INTERVAL = 30000; // 30 seconds
const SUBSCRIPTION_TIMEOUT = 10000; // 10 seconds

export function useLatestScan() {
  const [loading, setLoading] = useState<boolean>(true);
  const [latestScan, setLatestScan] = useState<ScanResult | null>(null);
  interface ScanResultData {
    [key: string]: unknown;
  }
  
  const [scanResult, setScanResult] = useState<ScanResultData | null>(null);
  const [scanAge, setScanAge] = useState<string>('Never');
  const [isRecent, setIsRecent] = useState<boolean>(false);
  const [hasData, setHasData] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for cleanup and debouncing
  type SupabaseSubscription = ReturnType<ReturnType<typeof supabase.channel>['subscribe']>;
  const subscriptionRef = useRef<SupabaseSubscription | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Calculate scan age helper
  const calculateScanAge = useCallback((timestamp: string) => {
    const completedAt = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - completedAt.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) {
      setScanAge('Just now');
      setIsRecent(true);
    } else if (diffMins < 60) {
      setScanAge(`${diffMins} minutes ago`);
      setIsRecent(diffMins < 30);
    } else if (diffMins < 1440) {
      const hours = Math.floor(diffMins / 60);
      setScanAge(`${hours} hour${hours > 1 ? 's' : ''} ago`);
      setIsRecent(hours < 3);
    } else {
      const days = Math.floor(diffMins / 1440);
      setScanAge(`${days} day${days > 1 ? 's' : ''} ago`);
      setIsRecent(false);
    }
  }, []);

  // Process scan data helper
  const processScanData = useCallback((scan: ScanResult) => {
    setLatestScan(scan);
    setHasData(true);

    // Calculate scan age
    calculateScanAge(scan.completed_at || scan.created_at);

    // Handle scan result data
    if (scan.scan_result) {
      try {
        setScanResult(
          typeof scan.scan_result === 'string'
            ? JSON.parse(scan.scan_result)
            : scan.scan_result
        );
      } catch (err) {
        console.error('Error parsing scan result:', err);
        setScanResult(null);
      }
    }

    setError(null);
  }, [calculateScanAge]);

  // Fetch latest scan with retry logic
  const fetchLatestScan = useCallback(async (isRetry = false) => {
    try {
      if (!isRetry) {
        setLoading(true);
      }
      
      const { data, error: supabaseError } = await supabase
        .from('scan_results')
        .select('*')
        .or('status.eq.running,status.eq.completed')
        .order('created_at', { ascending: false })
        .limit(1);

      if (supabaseError) {
        throw supabaseError;
      }

      // Reset retry count on successful fetch
      retryCountRef.current = 0;

      // Handle no results case
      if (!data || data.length === 0) {
        setHasData(false);
        setScanAge('Never');
        setIsRecent(false);
        setLatestScan(null);
        return;
      }

      processScanData((data[0] as unknown) as ScanResult);
    } catch (err) {
      console.error('Error fetching latest scan:', err);
      
      // Implement retry logic
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        retryTimeoutRef.current = setTimeout(() => {
          fetchLatestScan(true);
        }, RETRY_DELAY);
      } else {
        setHasData(false);
        setScanAge('Never');
        setIsRecent(false);
        setError('Failed to fetch scan data');
      }
    } finally {
      if (!isRetry) {
        setLoading(false);
      }
    }
  }, [processScanData]);

  // Debounced refresh function
  const refresh = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      fetchLatestScan();
    }, 300);
  }, [fetchLatestScan]);

  useEffect(() => {
    // Initial fetch
    fetchLatestScan();

    // Set up polling as primary update mechanism
    const pollInterval = setInterval(() => {
      if (!document.hidden) { // Only poll when tab is visible
        fetchLatestScan();
      }
    }, POLL_INTERVAL);

    // Set up subscription as backup with error handling
    const setupSubscription = async () => {
      try {
        if (subscriptionRef.current) {
          await subscriptionRef.current.unsubscribe();
        }

        // Set a timeout to fall back to polling if subscription fails
        const timeout = setTimeout(() => {
          console.log('Subscription timeout reached, falling back to polling');
          if (subscriptionRef.current) {
            subscriptionRef.current.unsubscribe();
          }
        }, SUBSCRIPTION_TIMEOUT);

        subscriptionRef.current = supabase
          .channel('scan_results_changes')
          .on('postgres_changes', {
            event: 'UPDATE',  // Only listen for updates
            schema: 'public',
            table: 'scan_results',
            filter: 'status=in.(running,completed)'
          }, (payload) => {
            if (payload.new && !document.hidden) { // Only process updates when tab is visible
              processScanData((payload.new as unknown) as ScanResult);
            }
          })
          .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              console.log('Successfully subscribed to scan results changes');
              clearTimeout(timeout);
            } else if (status === 'CHANNEL_ERROR') {
              console.log('Subscription error, falling back to polling');
              clearTimeout(timeout);
            }
          });
      } catch (err) {
        console.error('Error setting up subscription:', err);
        // Attempt to reconnect
        setTimeout(setupSubscription, RETRY_DELAY);
      }
    };

    setupSubscription();

    // Cleanup function
    return () => {
      // Clear all intervals and timeouts
      clearInterval(pollInterval);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [fetchLatestScan, processScanData]);

  return {
    loading,
    latestScan,
    scanResult,
    scanAge,
    isRecent,
    hasData,
    error,
    refresh
  };
}