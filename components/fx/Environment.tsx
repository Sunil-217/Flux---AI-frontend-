'use client';

import { useEffect } from 'react';
import { applyFx, readFx } from '@/lib/fx/prefs';

/**
 * Layers 0 and 1 — the room every screen sits in.
 *
 * Renders every environment layer once and lets CSS decide which are visible
 * for the active preset (`[data-fx-env]` on <html>). That keeps preset
 * switching a pure attribute flip with no remount, which is what makes the
 * Settings preview instant. All layers are `contain: strict` on a fixed
 * element: nothing reflows, nothing repaints on scroll.
 *
 * Also owns the single pointer listener for the page. Every cursor-reactive
 * surface reads --fx-mx / --fx-my off the root rather than attaching its own
 * handler.
 */
export function Environment() {
  useEffect(() => {
    // The boot script has already applied stored prefs before paint; this
    // re-applies in case the script was blocked (CSP, extension) and keeps the
    // attributes in sync when another tab changes them.
    applyFx(readFx());
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'close_ai_fx') applyFx(readFx());
    };
    window.addEventListener('storage', onStorage);

    const root = document.documentElement;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    if (!reduced) window.addEventListener('pointermove', onMove, { passive: true });

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pointermove', onMove);
      if (raf != null) cancelAnimationFrame(raf);
      root.style.removeProperty('--fx-mx');
      root.style.removeProperty('--fx-my');
    };
  }, []);

  return (
    <div className="fx-env" aria-hidden="true">
      <div className="fx-env__wash" />
      <div className="fx-env__stars" />
      <div className="fx-env__rain" />
      <div className="fx-env__aurora" />
      <div className="fx-env__lens" />
      <div className="fx-env__grid" />
      <div className="fx-env__horizon" />
    </div>
  );
}

/** Kept for existing imports. */
export const Atmosphere = Environment;

/**
 * Local pointer coordinates for one surface, as --fx-lx / --fx-ly (0..1 within
 * the element). `.fx-sheen` uses them to track the cursor across that card.
 */
export function trackLocalPointer(e: React.PointerEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  el.style.setProperty('--fx-lx', ((e.clientX - r.left) / r.width).toFixed(3));
  el.style.setProperty('--fx-ly', ((e.clientY - r.top) / r.height).toFixed(3));
}
