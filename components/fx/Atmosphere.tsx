'use client';

import { useEffect } from 'react';

/**
 * The room the interface sits in: a drifting volumetric wash, a receding
 * technical grid and a horizon line — all painted by CSS on one fixed,
 * `contain: strict` layer, so it never reflows and never repaints on scroll.
 *
 * It also owns the single pointer listener for the whole page. Every
 * cursor-reactive surface reads `--fx-mx` / `--fx-my` off the document root
 * instead of attaching its own handler; one rAF-throttled listener is the
 * difference between a page that responds to the cursor and a page that
 * stutters because forty components each wanted to know where it was.
 *
 * Skipped entirely under prefers-reduced-motion for the pointer work — the
 * static gradients stay, the tracking stops.
 */
export function Atmosphere() {
  useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf: number | null = null;
    let x = 0.5;
    let y = 0.5;

    const flush = () => {
      raf = null;
      root.style.setProperty('--fx-mx', x.toFixed(4));
      root.style.setProperty('--fx-my', y.toFixed(4));
    };

    const onMove = (e: PointerEvent) => {
      x = e.clientX / Math.max(window.innerWidth, 1);
      y = e.clientY / Math.max(window.innerHeight, 1);
      if (raf == null) raf = requestAnimationFrame(flush);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (raf != null) cancelAnimationFrame(raf);
      root.style.removeProperty('--fx-mx');
      root.style.removeProperty('--fx-my');
    };
  }, []);

  return (
    <>
      <div className="fx-atmosphere" aria-hidden="true" />
      <div className="fx-horizon" aria-hidden="true" />
    </>
  );
}

/**
 * Local pointer coordinates for a single surface, as `--fx-lx` / `--fx-ly`
 * (0..1 within the element). Used by `.fx-sheen`, whose highlight has to track
 * the cursor *across that card*, which the page-level variables cannot express.
 *
 * Attach with `onPointerMove={trackLocalPointer}`; there is no listener to
 * clean up because React owns it.
 */
export function trackLocalPointer(e: React.PointerEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  el.style.setProperty('--fx-lx', ((e.clientX - r.left) / r.width).toFixed(3));
  el.style.setProperty('--fx-ly', ((e.clientY - r.top) / r.height).toFixed(3));
}
