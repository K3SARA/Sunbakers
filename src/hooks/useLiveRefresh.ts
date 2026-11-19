import { useEffect, useRef } from 'react';

export interface LiveRefreshOptions {
  /** Whether the component is currently visible/active in the UI */
  isActive?: boolean;
  /** Whether to listen to window focus */
  refreshOnFocus?: boolean;
  /** Optional background polling interval in ms (e.g. 15000 for 15s) */
  pollInterval?: number;
}

/**
 * Custom hook to keep component data fresh and lively in real-time.
 * Automatically triggers refresh:
 * 1. When the tab becomes active (switched to from another page)
 * 2. When any API mutation occurs across the application ('app:data-changed' event)
 * 3. When the window gains focus (switched from another desktop app)
 * 4. Optionally at periodic intervals
 */
export function useLiveRefresh(
  refreshFn: () => void | Promise<any>,
  options: LiveRefreshOptions = {}
) {
  const { isActive = true, refreshOnFocus = true, pollInterval } = options;
  const fnRef = useRef(refreshFn);
  fnRef.current = refreshFn;

  const wasActiveRef = useRef(isActive);

  // 1. Refresh whenever component transitions from hidden to active
  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      try {
        fnRef.current();
      } catch (err) {
        console.warn('Error during active tab refresh', err);
      }
    }
    wasActiveRef.current = isActive;
  }, [isActive]);

  // 2. Listen to global mutation broadcast events ('app:data-changed')
  useEffect(() => {
    let timeoutId: any = null;

    const handleDataChanged = () => {
      if (!isActive) return;
      clearTimeout(timeoutId);
      // Small debounce to batch rapid sequential mutations
      timeoutId = setTimeout(() => {
        try {
          fnRef.current();
        } catch (err) {
          console.warn('Error during live data mutation refresh', err);
        }
      }, 150);
    };

    window.addEventListener('app:data-changed', handleDataChanged);
    return () => {
      window.removeEventListener('app:data-changed', handleDataChanged);
      clearTimeout(timeoutId);
    };
  }, [isActive]);

  // 3. Refresh when the app window gains focus
  useEffect(() => {
    if (!refreshOnFocus) return;

    const handleFocus = () => {
      if (isActive) {
        try {
          fnRef.current();
        } catch (err) {
          console.warn('Error during focus refresh', err);
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [isActive, refreshOnFocus]);

  // 4. Background polling interval (if specified)
  useEffect(() => {
    if (!pollInterval || pollInterval <= 0) return;

    const intervalId = setInterval(() => {
      if (isActive && document.visibilityState === 'visible') {
        try {
          fnRef.current();
        } catch (err) {
          console.warn('Error during polling refresh', err);
        }
      }
    }, pollInterval);

    return () => clearInterval(intervalId);
  }, [isActive, pollInterval]);
}

