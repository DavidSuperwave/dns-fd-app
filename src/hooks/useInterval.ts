import { useEffect, useRef } from 'react';

/**
 * Custom hook for setting up an interval that works properly with React's lifecycle
 * 
 * @param callback Function to call on each interval
 * @param delay Delay in milliseconds, or null to pause the interval
 */
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef<() => void>(undefined);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    // Don't schedule if delay is null
    if (delay === null) return;
    
    const id = setInterval(() => {
      if (savedCallback.current) {
        savedCallback.current();
      }
    }, delay);
    
    // Clean up on unmount or when delay changes
    return () => clearInterval(id);
  }, [delay]);
}