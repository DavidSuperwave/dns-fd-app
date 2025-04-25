import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase-client';

// Define the scan progress interface
export interface ScanProgress {
  id: number;
  scan_id: string;
  status: 'initializing' | 'fetching' | 'processing' | 'completed' | 'failed';
  current_page: number;
  total_pages: number | null;
  domains_processed: number;
  total_domains: number | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  is_active: boolean;
  error_message: string | null;
}

// Custom hook to track active scan progress and history
export function useScanProgress() {
  const [activeScan, setActiveScan] = useState<ScanProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastScans, setLastScans] = useState<ScanProgress[]>([]);
  
  // Memoize Supabase client
  
  // Function to fetch the active scan
  const fetchActiveScan = useCallback(async () => {
    console.log('[ScanProgress] Fetching active scan...');
    try {
      // First try to find an active, non-completed scan
      const { data: activeData, error: fetchError } = await supabase
        .from('scan_progress')
        .select('*')
        .eq('is_active', true)
        .neq('status', 'completed')
        .neq('status', 'failed')
        .order('started_at', { ascending: false })
        .limit(1);

      console.log('[ScanProgress] Active scan query result:', activeData);
      
      if (activeData && activeData.length > 0) {
        console.log('[ScanProgress] Found active scan:', activeData[0]);
        setActiveScan(activeData[0] as ScanProgress);
        return;
      }
      
      if (fetchError) {
        console.error('Error fetching active scan:', fetchError);
        setError(fetchError.message);
        return;
      }

      // If no active scan, get the most recent completed one
      const { data: completedData } = await supabase
        .from('scan_progress')
        .select('*')
        .in('status', ['completed', 'failed'])
        .order('started_at', { ascending: false })
        .limit(1);

      console.log('[ScanProgress] Completed scan query result:', completedData);
      setActiveScan(completedData?.[0] as ScanProgress || null);
    } catch (err) {
      console.error('Exception in fetchActiveScan:', err);
      setError('Failed to fetch active scan data');
    }
  }, []); // Removed supabase dependency
  
  // Function to fetch recent scan history
  const fetchScanHistory = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('scan_progress')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(5);
      
      if (fetchError) {
        console.error('Error fetching scan history:', fetchError);
        setError(fetchError.message);
        return;
      }
      
      if (data) {
        setLastScans(data as ScanProgress[]);
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error('Exception in fetchScanHistory:', err);
      setError('Failed to fetch scan history');
      setIsLoading(false);
    }
  }, []); // Removed supabase dependency
  
  // Set up Supabase real-time subscription for scan progress updates
  useEffect(() => {
    console.log('[ScanProgress Hook] Setting up Supabase subscription');
    
    // Fetch initial data
    const loadInitialData = async () => {
      await Promise.all([
        fetchActiveScan(),
        fetchScanHistory()
      ]);
    };
    loadInitialData();
    
    // Subscribe to changes in the scan_progress table
    const subscription = supabase
      .channel('scan_progress_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scan_progress',
          filter: "is_active=eq.true and status=neq.completed and status=neq.failed"
        },
        (payload) => {
          console.log('[ScanProgress Hook] Received update:', payload);
          
          console.log('[ScanProgress] Received subscription update:', payload);
          
          // For active scans, update immediately
          if (payload.eventType === 'INSERT') {
            console.log('[ScanProgress] New scan started:', payload.new);
            setActiveScan(payload.new as ScanProgress);
          } else if (payload.eventType === 'UPDATE') {
            console.log('[ScanProgress] Scan updated:', payload.new);
            setActiveScan(payload.new as ScanProgress);
          }
          
          // Always fetch fresh data to catch any state changes
          fetchActiveScan();
        }
      )
      .subscribe();
    
    // Clean up subscription on unmount
    return () => {
      console.log('[ScanProgress Hook] Cleaning up subscription');
      supabase.removeChannel(subscription);
    };
  }, [fetchActiveScan, fetchScanHistory]); // Removed supabase dependency
  
  // Poll every second during active scans, otherwise every 5 seconds
  const pollInterval = activeScan?.is_active && !['completed', 'failed'].includes(activeScan.status || '')
    ? 1000
    : 5000;

  useEffect(() => {
    console.log('[ScanProgress] Setting up polling with interval:', pollInterval);
    
    const interval = setInterval(() => {
      console.log('[ScanProgress] Polling for updates...');
      fetchActiveScan();
    }, pollInterval);
    
    return () => clearInterval(interval);
  }, [pollInterval, fetchActiveScan]);

  // Update history when scan completes
  useEffect(() => {
    const isComplete = activeScan?.status === 'completed' || activeScan?.status === 'failed';
    const wasActive = activeScan?.is_active === false && ['completed', 'failed'].includes(activeScan?.status || '');
    
    if (isComplete || wasActive) {
      console.log('[ScanProgress] Scan completed or became inactive, updating history');
      fetchScanHistory();
    }
  }, [activeScan?.status, activeScan?.is_active, fetchScanHistory]);
  
  // Calculate progress percentage
  const progressPercentage = activeScan && activeScan.total_domains 
    ? Math.round((activeScan.domains_processed / activeScan.total_domains) * 100)
    : activeScan?.status === 'completed' ? 100 : 0;
  
  // Format the elapsed time for the active scan
  const getElapsedTime = () => {
    if (!activeScan) return '';
    
    const start = new Date(activeScan.started_at).getTime();
    const end = activeScan.completed_at 
      ? new Date(activeScan.completed_at).getTime() 
      : new Date().getTime();
    
    const elapsed = end - start;
    const seconds = Math.floor(elapsed / 1000);
    
    if (seconds < 60) {
      return `${seconds}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    }
  };
  
  return {
    activeScan,
    lastScans,
    isLoading,
    error,
    progressPercentage,
    elapsedTime: getElapsedTime(),
    refreshData: () => {
      fetchActiveScan();
      fetchScanHistory();
    }
  };
}