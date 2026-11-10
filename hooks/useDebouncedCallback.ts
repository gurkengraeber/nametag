'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';

/**
 * Runs `callback` once `delayMs` after the last call to `run`, always with the
 * latest callback. A pending call is dropped by `cancel` and when the
 * component unmounts, so nothing fires after the user has left the page.
 */
export function useDebouncedCallback<A extends unknown[]>(
  callback: (...args: A) => void,
  delayMs: number
) {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  });

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const run = useCallback(
    (...args: A) => {
      cancel();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        callbackRef.current(...args);
      }, delayMs);
    },
    [cancel, delayMs]
  );

  useEffect(() => cancel, [cancel]);

  return useMemo(() => ({ run, cancel }), [run, cancel]);
}
