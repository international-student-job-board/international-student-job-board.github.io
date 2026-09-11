import { useEffect, useState } from 'react';

/**
 * Tracks a CSS media query. SSR- and jsdom-safe: falls back to `false` when
 * `matchMedia` isn't there, and reads it once on mount.
 */
export function useMediaQuery(query: string): boolean {
  const read = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false;

  const [matches, setMatches] = useState(read);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);

  return matches;
}

/** The breakpoint the stylesheet treats as "phone". */
export const useIsMobile = () => useMediaQuery('(max-width: 640px)');
