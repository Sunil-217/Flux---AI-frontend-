'use client';

import { useEffect, useRef } from 'react';
import type { CoreHandle, CoreState } from '@/lib/fx/aiCoreScene';

export type { CoreState };

interface Props {
  state?: CoreState;
  /** Rendered size in px. The canvas backing store is derived from this. */
  size?: number;
  className?: string;
  /** Decorative by default: whatever state the core shows is also stated in
   *  text beside it, so a screen reader gains nothing from the canvas. */
  label?: string;
}

/** Cheap capability probe — cheaper than loading three only to discover the
 *  browser cannot run it. */
function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(
      c.getContext('webgl2') ||
      c.getContext('webgl') ||
      c.getContext('experimental-webgl')
    );
  } catch {
    return false;
  }
}

function readAccent(): string {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent')
    .trim();
  return v || '#7c6cff';
}

/**
 * The AI intelligence core.
 *
 * **The CSS core is the component; WebGL is an enhancement layered over it.**
 * That inversion matters. Server render, first client render and every
 * WebGL-less browser all produce the same markup — concentric rings on
 * different axes around a lit nucleus — so there is no hydration mismatch, no
 * loading placeholder, and no "broken component" state to design around. When
 * WebGL is available the effect appends a canvas and marks the host; CSS hides
 * the rings underneath.
 *
 * Three things keep a WebGL centrepiece from being the usual mistake:
 *
 *  - `three` is dynamic-imported, absent from the initial bundle, and fetched
 *    only once WebGL is confirmed AND the element is actually on screen.
 *  - The loop stops when the tab is hidden or the core scrolls away. An
 *    animation nobody is looking at is pure battery cost.
 *  - `prefers-reduced-motion` renders one frame and stops. The object is still
 *    there, still lit, still three-dimensional — it simply holds still.
 */
export function AICore({ state = 'idle', size = 280, className = '', label }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<CoreHandle | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !webglAvailable()) return;

    let cancelled = false;
    let onScreen = false;
    let started = 0;
    let canvas: HTMLCanvasElement | null = null;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const loop = () => {
      rafRef.current = null;
      const h = handleRef.current;
      if (!h || cancelled) return;
      h.frame((performance.now() - started) / 1000);
      if (!reduced && onScreen && !document.hidden) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    const kick = () => {
      if (rafRef.current == null && !cancelled && onScreen && !document.hidden) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    const stop = () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };

    async function boot() {
      try {
        const { createAICore } = await import('@/lib/fx/aiCoreScene');
        if (cancelled || !host) return;

        canvas = document.createElement('canvas');
        canvas.className = 'fx-core__canvas';
        host.appendChild(canvas);

        // Fewer points on small screens: the shell is physically smaller, so
        // the extra density is invisible but still paid for.
        const narrow = window.innerWidth < 768;
        const handle = createAICore(canvas, {
          accent: readAccent(),
          particles: narrow ? 380 : 900,
          still: reduced,
        });
        handleRef.current = handle;
        host.dataset.webgl = 'on';

        const r = host.getBoundingClientRect();
        handle.resize(r.width, r.height);
        handle.setState(state);
        started = performance.now();

        if (!reduced) {
          window.addEventListener('pointermove', onPointer, { passive: true });
        }
        // One frame regardless, so reduced-motion still gets a lit object.
        handle.frame(0);
        kick();
      } catch (err) {
        // three failed to load, or the context was refused. The CSS core is
        // already rendered underneath, so the user sees a finished component
        // either way — but silently swallowing this makes "why is the core
        // flat?" unanswerable, so it is reported once, at warn level.
        if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
        canvas = null;
        console.warn('[AICore] falling back to the CSS core:', err);
      }
    }

    const onPointer = (e: PointerEvent) => {
      handleRef.current?.setPointer(
        e.clientX / Math.max(window.innerWidth, 1),
        e.clientY / Math.max(window.innerHeight, 1),
      );
    };

    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((e) => e.isIntersecting);
        if (!onScreen) stop();
        else if (!handleRef.current) void boot();
        else kick();
      },
      { rootMargin: '128px' },
    );
    io.observe(host);

    const onVisibility = () => (document.hidden ? stop() : kick());
    document.addEventListener('visibilitychange', onVisibility);

    const ro = new ResizeObserver(() => {
      const r = host.getBoundingClientRect();
      handleRef.current?.resize(r.width, r.height);
    });
    ro.observe(host);

    return () => {
      cancelled = true;
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointer);
      stop();
      handleRef.current?.dispose();
      handleRef.current = null;
      if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
      delete host.dataset.webgl;
    };
    // `state` reaches the scene through the imperative handle in the effect
    // below. Listing it here would tear down and rebuild the entire GL context
    // on every status change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    handleRef.current?.setState(state);
  }, [state]);

  return (
    <div
      ref={hostRef}
      className={`fx-core fx-core--${state} ${className}`}
      style={{ width: size, height: size }}
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <div className="fx-core__css" aria-hidden="true">
        <span className="fx-core__ring fx-core__ring--1" />
        <span className="fx-core__ring fx-core__ring--2" />
        <span className="fx-core__ring fx-core__ring--3" />
        <span className="fx-core__nucleus" />
      </div>
    </div>
  );
}
