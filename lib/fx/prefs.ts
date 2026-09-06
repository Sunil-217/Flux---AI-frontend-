'use client';

/**
 * Visual-experience preferences — the settings that make Flux AI look and move
 * the way THIS user wants it to.
 *
 * Follows the same contract as the theme system in lib/appTemplates: one
 * localStorage key, applied to <html> as data attributes and CSS variables, and
 * restored before first paint by the boot script in app/layout.tsx so a chosen
 * look never flashes back to the default on reload.
 *
 * Every field here is read by something. There are no decorative toggles: each
 * attribute below is a selector in app/fx.css or a branch in the WebGL scene,
 * and the Settings panel is a plain view over this object — if a control does
 * nothing it is because it was wired to nothing, and that is a bug.
 */

export const FX_KEY = 'close_ai_fx';

export type CorePreset =
  | 'neural'
  | 'orbital'
  | 'lattice'
  | 'reactor'
  | 'cortex'
  | 'singularity'
  | 'galaxy'
  | 'synthetic';

export type Environment =
  | 'neural-space'
  | 'holo-lab'
  | 'quantum-grid'
  | 'deep-space'
  | 'digital-rain'
  | 'aurora'
  | 'minimal'
  | 'dark-matter';

export type Motion = 'off' | 'calm' | 'normal' | 'lively';
export type Particles = 'low' | 'medium' | 'high';
export type Speed = 'slow' | 'normal' | 'fast';

export interface FxPrefs {
  /** Which intelligence-core geometry renders. */
  core: CorePreset;
  /** The room the interface sits in: grid, stars, rain, aurora … */
  environment: Environment;
  /** Particle density for the WebGL core. Mobile caps this one tier lower. */
  particles: Particles;
  /** 0–1. Ambient bleed, halos, sheen. 0 is a clean instrument panel. */
  glow: number;
  /** 0–1. Parallax and perspective amount. */
  depth: number;
  /** Ambient motion — the drift, the grid run, the particle orbit. */
  motion: Motion;
  /** Multiplier on every transition and reveal. */
  speed: Speed;
  /** Hover lift / sheen / press feedback. */
  hover: boolean;
  /** Master switch for WebGL. Off = the CSS core everywhere, zero GL contexts. */
  webgl: boolean;
  /** Higher-contrast borders and text tiers. */
  contrast: boolean;
}

export const DEFAULT_FX: FxPrefs = {
  core: 'neural',
  environment: 'neural-space',
  particles: 'medium',
  glow: 0.6,
  depth: 0.6,
  motion: 'normal',
  speed: 'normal',
  hover: true,
  webgl: true,
  contrast: false,
};

export const CORE_PRESETS: { key: CorePreset; label: string; blurb: string }[] = [
  { key: 'neural', label: 'Neural Core', blurb: 'Icosahedral shell, neural chords, orbiting field.' },
  { key: 'orbital', label: 'Holographic Orbital', blurb: 'Tilted rings on three axes around a quiet nucleus.' },
  { key: 'lattice', label: 'Quantum Grid', blurb: 'A rotating point lattice — structure over surface.' },
  { key: 'reactor', label: 'AI Reactor', blurb: 'Concentric torus rings and a hot, contained centre.' },
  { key: 'cortex', label: 'Digital Brain', blurb: 'Two dense hemispheres of points, softly folded.' },
  { key: 'singularity', label: 'Singularity', blurb: 'An accretion disc of particles around a dark centre.' },
  { key: 'galaxy', label: 'Data Galaxy', blurb: 'Spiral arms of data points, slowly turning.' },
  { key: 'synthetic', label: 'Synthetic Intelligence', blurb: 'Nested octahedra — crystalline and exact.' },
];

export const ENVIRONMENTS: { key: Environment; label: string; blurb: string }[] = [
  { key: 'neural-space', label: 'Neural Space', blurb: 'Volumetric wash and a receding technical grid.' },
  { key: 'holo-lab', label: 'Holographic Laboratory', blurb: 'Fine cross-hatch, bright edges, clinical light.' },
  { key: 'quantum-grid', label: 'Quantum Grid', blurb: 'A dense isometric lattice, gently drifting.' },
  { key: 'deep-space', label: 'Deep Space', blurb: 'Stars. No grid. Long horizon.' },
  { key: 'digital-rain', label: 'Digital Rain', blurb: 'Vertical data streams falling through the room.' },
  { key: 'aurora', label: 'Synthetic Aurora', blurb: 'Slow curtains of light along the top edge.' },
  { key: 'minimal', label: 'Minimal Intelligence', blurb: 'A single horizon line. Nothing else.' },
  { key: 'dark-matter', label: 'Dark Matter', blurb: 'Near-black, a faint gravitational lens, no grid.' },
];

const MOTION_SCALE: Record<Motion, number> = { off: 0, calm: 0.45, normal: 1, lively: 1.6 };
const SPEED_SCALE: Record<Speed, number> = { slow: 1.6, normal: 1, fast: 0.6 };
const PARTICLE_COUNT: Record<Particles, number> = { low: 420, medium: 900, high: 1600 };

export function particleCount(p: Particles): number {
  return PARTICLE_COUNT[p];
}

function clamp01(n: unknown, fallback: number): number {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(v as string) ? (v as T) : fallback;
}

/** Parse a stored blob, tolerating anything a previous build may have written. */
export function normalise(raw: unknown): FxPrefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof FxPrefs, unknown>>;
  return {
    core: oneOf(r.core, CORE_PRESETS.map((p) => p.key), DEFAULT_FX.core),
    environment: oneOf(r.environment, ENVIRONMENTS.map((e) => e.key), DEFAULT_FX.environment),
    particles: oneOf(r.particles, ['low', 'medium', 'high'] as const, DEFAULT_FX.particles),
    glow: clamp01(r.glow, DEFAULT_FX.glow),
    depth: clamp01(r.depth, DEFAULT_FX.depth),
    motion: oneOf(r.motion, ['off', 'calm', 'normal', 'lively'] as const, DEFAULT_FX.motion),
    speed: oneOf(r.speed, ['slow', 'normal', 'fast'] as const, DEFAULT_FX.speed),
    hover: typeof r.hover === 'boolean' ? r.hover : DEFAULT_FX.hover,
    webgl: typeof r.webgl === 'boolean' ? r.webgl : DEFAULT_FX.webgl,
    contrast: typeof r.contrast === 'boolean' ? r.contrast : DEFAULT_FX.contrast,
  };
}

export function readFx(): FxPrefs {
  if (typeof window === 'undefined') return DEFAULT_FX;
  try {
    return normalise(JSON.parse(localStorage.getItem(FX_KEY) || 'null'));
  } catch {
    return DEFAULT_FX;
  }
}

/**
 * Push preferences onto <html>. Pure DOM work, safe to call from anywhere.
 *
 * Attributes carry the discrete choices (CSS selects on them); variables carry
 * the continuous ones (CSS multiplies by them). The scene reads the same
 * object directly, so the canvas and the stylesheet never disagree.
 */
export function applyFx(p: FxPrefs): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.fxCore = p.core;
  root.dataset.fxEnv = p.environment;
  root.dataset.fxMotion = p.motion;
  root.dataset.fxHover = p.hover ? 'on' : 'off';
  root.dataset.fxWebgl = p.webgl ? 'on' : 'off';
  root.dataset.fxContrast = p.contrast ? 'on' : 'off';
  root.style.setProperty('--fx-glow', p.glow.toFixed(2));
  root.style.setProperty('--fx-depth', p.depth.toFixed(2));
  root.style.setProperty('--fx-motion', MOTION_SCALE[p.motion].toFixed(2));
  root.style.setProperty('--fx-speed', SPEED_SCALE[p.speed].toFixed(2));
}

export function saveFx(p: FxPrefs): void {
  applyFx(p);
  try {
    localStorage.setItem(FX_KEY, JSON.stringify(p));
  } catch {
    /* private mode / quota — applied for this session regardless */
  }
  // Same-tab listeners (the scene, the environment) hear this; other tabs get
  // the native `storage` event.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fx:change', { detail: p }));
  }
}

export function updateFx(patch: Partial<FxPrefs>): FxPrefs {
  const next = normalise({ ...readFx(), ...patch });
  saveFx(next);
  return next;
}

export function resetFx(): FxPrefs {
  saveFx(DEFAULT_FX);
  return DEFAULT_FX;
}

/**
 * Inline boot snippet — restores attributes/variables BEFORE first paint.
 * Mirrors applyFx exactly; kept as a string so app/layout.tsx can inject it.
 * No JSON schema validation here on purpose: anything unparseable falls back
 * to the CSS defaults, which are the same as DEFAULT_FX.
 */
export const FX_BOOT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem('${FX_KEY}')||'null');if(!p||typeof p!=='object')return;var r=document.documentElement;var d=r.dataset;if(typeof p.core==='string')d.fxCore=p.core;if(typeof p.environment==='string')d.fxEnv=p.environment;if(typeof p.motion==='string')d.fxMotion=p.motion;d.fxHover=p.hover===false?'off':'on';d.fxWebgl=p.webgl===false?'off':'on';d.fxContrast=p.contrast===true?'on':'off';var m={off:0,calm:0.45,normal:1,lively:1.6},s={slow:1.6,normal:1,fast:0.6};if(typeof p.glow==='number')r.style.setProperty('--fx-glow',String(Math.min(1,Math.max(0,p.glow))));if(typeof p.depth==='number')r.style.setProperty('--fx-depth',String(Math.min(1,Math.max(0,p.depth))));if(p.motion in m)r.style.setProperty('--fx-motion',String(m[p.motion]));if(p.speed in s)r.style.setProperty('--fx-speed',String(s[p.speed]));}catch(e){}})();`;
