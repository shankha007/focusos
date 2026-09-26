import { useEffect, useState } from 'react';
import { addDays, startOfDay } from '@/lib/utils';

/**
 * Midnight at the start of today, as a timestamp — and a new one when the date
 * changes while the page is open.
 *
 * For anything derived from "today" that is memoised on its data alone: left
 * open past midnight it would otherwise keep yesterday as today until the data
 * happened to change. A timer handles the page staying open; a sleeping
 * machine delays timers, so returning to the tab checks the date again too.
 */
export function useToday(): number {
  const [today, setToday] = useState(() => startOfDay());

  useEffect(() => {
    const refresh = () => {
      const now = startOfDay();
      if (now !== today) setToday(now);
    };
    // A second past midnight, clear of any rounding at the boundary itself.
    const id = window.setTimeout(refresh, addDays(today, 1) - Date.now() + 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [today]);

  return today;
}
