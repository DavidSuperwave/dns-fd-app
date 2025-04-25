import { useState, useCallback, useRef } from 'react';
import { useAuth } from '../components/auth/auth-provider';
import { toast } from 'sonner';

// Minimum time between refreshes in milliseconds
const REFRESH_COOLDOWN = 15000; // 15 seconds

/**
 * Custom hook for controlled session refresh with rate limiting
 * Prevents excessive refreshes that might lead to rate limit errors
 */
export function useAuthRefresh() {
  const { refreshSession } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastRefreshTime = useRef(0);

  const refreshWithControl = useCallback(async (showToast = false) => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTime.current;
    
    // Check if refresh is allowed (enough time passed)
    if (timeSinceLastRefresh < REFRESH_COOLDOWN) {
      console.log(`[useAuthRefresh] Skipping refresh - cooldown period (${Math.round((REFRESH_COOLDOWN - timeSinceLastRefresh) / 1000)}s remaining)`);
      if (showToast) {
        toast.info(`Please wait before refreshing again (${Math.round((REFRESH_COOLDOWN - timeSinceLastRefresh) / 1000)}s)`);
      }
      return false;
    }
    
    // Perform refresh
    setIsRefreshing(true);
    try {
      console.log('[useAuthRefresh] Refreshing auth session...');
      await refreshSession(false); // Don't force refresh to prevent API hammering
      lastRefreshTime.current = Date.now();
      
      if (showToast) {
        toast.success("Authentication refreshed successfully");
      }
      
      return true;
    } catch (error) {
      console.error('[useAuthRefresh] Error refreshing session:', error);
      
      if (showToast) {
        toast.error("Failed to refresh authentication");
      }
      
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshSession]);

  return {
    refreshWithControl,
    isRefreshing
  };
}