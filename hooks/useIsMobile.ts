'use client';

import { useEffect, useState } from 'react';

// True on phone-sized viewports (< md / 768px — the same breakpoint the sidebar
// uses to switch from an overlay to a fixed column). Starts `false` so the
// server-rendered markup matches the first client paint (no hydration
// mismatch), then corrects on mount and on every resize.
export function useIsMobile(query = '(max-width: 767px)'): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [query]);

  return isMobile;
}
