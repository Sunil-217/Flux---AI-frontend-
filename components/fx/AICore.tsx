'use client';

import { useEffect, useRef } from 'react';
import type { CoreHandle, CoreState } from '@/lib/fx/aiCoreScene';
import { particleCount, readFx, type FxPrefs } from '@/lib/fx/prefs';

export type { CoreState };

interface Props {
  state?: CoreState;
  size?: number;
  className?: string;
  /** Decorative unless labelled — the state it shows is always also text. */
  label?: string;
  /** Force a preset (e.g. Settings preview tiles). Defaults to the user's pick. */
  preset?: FxPrefs['core'];
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

function readAccent(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7c6cff';
}

function readMode(): 'light' | 'dark' {
  return document.documentElement.classList.contains('light') ? 'light' : 'dark';
}

/**
 * The intelligence core.
 *
 * The CSS core is the component; WebGL is an enhancement layered over it, so
 * server render, first client render and every WebGL-less (or WebGL-off)
 * browser produce identical markup — no hydration mismatch, no placeholder.
 *
 * Preference-aware: it rebuilds the scene when the user changes the preset,
 * particle density, WebGL switch or motion in Settings (via `fx:change`), and
 * when the theme flips light/dark (the blending model is different — see the
 * scene). Rebuilding is a full dispose + create, never a leak.
 *
 * `three` is dynamic-imported behind a WebGL probe AND an IntersectionObserver;
 * the loop stops when the tab is hidden or the core scrolls away.
 */
export function AICore({ state = 'idle', size = 280, className = '', label, preset }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<CoreHandle | null>(null);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef<CoreState>(state);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let onScreen = false;
    let started = 0;
    let canvas: HTMLCanvasElement | null = null;
    let generation = 0;

    const reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

    const stop = () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };

    const teardown = () => {
      stop();
      handleRef.current?.dispose();
      handleRef.current = null;
      if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
      canvas = null;
      delete host.dataset.webgl;
    };

    const loop = () => {
      rafRef.current = null;
      const h = handleRef.current;
      if (!h || cancelled) return;
      h.frame((performance.now() - started) / 1000);
      const still = reducedMQ.matches || readFx().motion === 'off';
      if (!still && onScreen && !document.hidden) rafRef.current = requestAnimationFrame(loop);
    };

    const kick = () => {
      if (rafRef.current == null && !cancelled && onScreen && !document.hidden && handleRef.current) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    const onPointer = (e: PointerEvent) => {
      handleRef.current?.setPointer(e.clientX / Math.max(window.innerWidth, 1), e.clientY / Math.max(window.innerHeight, 1));
    };

    async function boot() {
      const prefs = readFx();
      if (!prefs.webgl || !webglAvailable()) return;
      const myGen = ++generation;
      try {
        const { createAICore } = await import('@/lib/fx/aiCoreScene');
        if (cancelled || myGen !== generation || !host) return;

        canvas = document.createElement('canvas');
        canvas.className = 'fx-core__canvas';
        host.appendChild(canvas);

        const narrow = window.innerWidth < 768;
        const still = reducedMQ.matches || prefs.motion === 'off';
        const motion = prefs.motion === 'off' ? 0 : prefs.motion === 'calm' ? 0.45 : prefs.motion === 'lively' ? 1.6 : 1;
        // Mobile caps density one tier lower: the shell is physically smaller
        // there, so the extra points are paid for and never seen.
        const count = particleCount(prefs.particles);
        const handle = createAICore(canvas, {
          accent: readAccent(),
          mode: readMode(),
          preset: preset ?? prefs.core,
          particles: narrow ? Math.round(count * 0.42) : count,
          still,
          motion,
        });
        handleRef.current = handle;
        host.dataset.webgl = 'on';

        const r = host.getBoundingClientRect();
        handle.resize(r.width, r.height);
        handle.setState(stateRef.current);
        started = performance.now();
        handle.frame(0);
        kick();
      } catch (err) {
        if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
        canvas = null;
        console.warn('[AICore] falling back to the CSS core:', err);
      }
    }

    const rebuild = () => {
      if (cancelled) return;
      teardown();
      if (onScreen) void boot();
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

    window.addEventListener('pointermove', onPointer, { passive: true });

    // Settings changed the preset / density / switch / motion → rebuild.
    window.addEventListener('fx:change', rebuild);
    // Template or light/dark toggled → the blending model changes → rebuild.
    //
    // Guarded, because Environment writes --fx-mx/--fx-my to this same style
    // attribute on every pointer move: rebuilding on any style mutation would
    // tear the GL context down and back up as the cursor crossed the page. Only
    // a change to the inline --accent (what a template sets) or to the
    // light/dark class counts. Reading the inline value is a property lookup,
    // not a layout.
    let lastAccent = document.documentElement.style.getPropertyValue('--accent');
    let lastMode = readMode();
    const mo = new MutationObserver(() => {
      const accent = document.documentElement.style.getPropertyValue('--accent');
      const mode = readMode();
      if (accent !== lastAccent || mode !== lastMode) {
        lastAccent = accent;
        lastMode = mode;
        rebuild();
      }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    reducedMQ.addEventListener('change', rebuild);

    return () => {
      cancelled = true;
      io.disconnect();
      ro.disconnect();
      mo.disconnect();
      reducedMQ.removeEventListener('change', rebuild);
      window.removeEventListener('fx:change', rebuild);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointer);
      teardown();
    };
    // `state` reaches the scene through the imperative handle below; `preset`
    // is a rebuild trigger by identity and listed here.
  }, [preset]);

  useEffect(() => {
    // Mirrored into a ref so an async boot() that finishes later starts on the
    // current state rather than the one it was kicked off with.
    stateRef.current = state;
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
