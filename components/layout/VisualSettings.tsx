'use client';

import { useEffect, useState } from 'react';
import { AICore } from '@/components/fx/AICore';
import {
  CORE_PRESETS,
  DEFAULT_FX,
  ENVIRONMENTS,
  readFx,
  resetFx,
  updateFx,
  type FxPrefs,
} from '@/lib/fx/prefs';
import { DENSITY_KEY, applyDensity, clearTemplateMark } from '@/lib/appTemplates';

/**
 * Settings → Visual System.
 *
 * A view over lib/fx/prefs. Every control writes a preference, every
 * preference is a data attribute or variable on <html> that app/fx.css and the
 * WebGL scene read — so a change here changes the page immediately, with no
 * "apply" button and no decorative toggles. The live core at the top is the
 * user's actual preset, re-rendered by the same event the rest of the app hears.
 */

type Density = 'compact' | 'comfortable' | 'spacious';

const heading = 'text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-4)] mb-2.5';
const help = 'text-[12px] leading-relaxed text-[var(--ink-3)]';

function Seg<T extends string>({
  value, options, onChange, label,
}: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex w-full rounded-lg border border-[var(--line)] bg-[var(--base)] p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          onClick={() => onChange(o.key)}
          className={`fx-press flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            value === o.key ? 'bg-[var(--fill-strong)] text-[var(--ink)] shadow-[0_0_0_1px_var(--fx-edge-soft)]' : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Range({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="fx-range"
        style={{ ['--fx-pct' as string]: `${pct}%` }}
      />
      <span className="w-9 text-right font-mono text-[11px] tabular-nums text-[var(--ink-3)]">{pct}%</span>
    </div>
  );
}

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="fx-press flex w-full items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--fill)] px-3.5 py-3 text-left hover:bg-[var(--fill-hover)]"
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-[var(--ink)]">{label}</span>
        <span className={help}>{hint}</span>
      </span>
      <span
        className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${on ? 'bg-[var(--accent)]' : 'bg-[var(--line-strong)]'}`}
        aria-hidden
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

/** Tiny SVG glyph per core preset — a cheap preview that needs no GL context. */
function PresetGlyph({ preset }: { preset: FxPrefs['core'] }) {
  const stroke = 'var(--accent)';
  const g = { fill: 'none', stroke, strokeWidth: 1, opacity: 0.9 } as const;
  return (
    <svg viewBox="0 0 80 44" className="absolute inset-0 h-full w-full" aria-hidden>
      {preset === 'neural' && (<><polygon points="40,6 62,18 56,38 24,38 18,18" {...g} /><circle cx="40" cy="22" r="17" {...g} strokeDasharray="2 4" /></>)}
      {preset === 'orbital' && (<><circle cx="40" cy="22" r="5" fill={stroke} opacity="0.8" /><ellipse cx="40" cy="22" rx="20" ry="7" {...g} /><ellipse cx="40" cy="22" rx="14" ry="16" {...g} transform="rotate(-30 40 22)" /><ellipse cx="40" cy="22" rx="24" ry="9" {...g} transform="rotate(25 40 22)" /></>)}
      {preset === 'lattice' && (<>{[16, 28, 40, 52, 64].map((x) => [10, 22, 34].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.3" fill={stroke} />))}<rect x="16" y="10" width="48" height="24" {...g} /></>)}
      {preset === 'reactor' && (<><circle cx="40" cy="22" r="5" fill={stroke} /><ellipse cx="40" cy="22" rx="12" ry="4" {...g} /><ellipse cx="40" cy="22" rx="19" ry="6" {...g} /><ellipse cx="40" cy="22" rx="26" ry="8" {...g} /></>)}
      {preset === 'cortex' && (<><path d="M22 30c-8-6-6-20 6-22 4-3 10-2 12 2 3-4 9-4 12-1 12 2 14 16 6 22-4 5-10 6-14 2-4 4-10 3-14-2z" {...g} /><path d="M40 10v24" {...g} strokeDasharray="1 3" /></>)}
      {preset === 'singularity' && (<><circle cx="40" cy="22" r="6" fill="var(--base)" stroke={stroke} strokeWidth="1" /><ellipse cx="40" cy="22" rx="27" ry="7" {...g} strokeDasharray="1 2" /><ellipse cx="40" cy="22" rx="18" ry="4.5" {...g} /></>)}
      {preset === 'galaxy' && (<><path d="M40 22c0-6 6-8 12-6-6 2-8 8-4 12M40 22c0 6-6 8-12 6 6-2 8-8 4-12M40 22c6 0 8 6 6 12-2-6-8-8-12-4" {...g} /><circle cx="40" cy="22" r="2" fill={stroke} /></>)}
      {preset === 'synthetic' && (<><polygon points="40,4 58,22 40,40 22,22" {...g} /><polygon points="40,10 52,22 40,34 28,22" {...g} /><polygon points="40,16 46,22 40,28 34,22" fill={stroke} opacity="0.7" /></>)}
    </svg>
  );
}

/** Environment swatch — CSS only, same tokens the real layer uses. */
function EnvSwatch({ env }: { env: FxPrefs['environment'] }) {
  const base: React.CSSProperties = { position: 'absolute', inset: 0 };
  const wash = 'radial-gradient(60% 70% at 30% 30%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 70%)';
  const grid = 'linear-gradient(to right, color-mix(in srgb, var(--ink) 12%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--ink) 12%, transparent) 1px, transparent 1px)';
  const styles: Record<FxPrefs['environment'], React.CSSProperties> = {
    'neural-space': { ...base, backgroundImage: `${wash}, ${grid}`, backgroundSize: 'auto, 9px 9px' },
    'holo-lab': { ...base, backgroundImage: grid, backgroundSize: '5px 5px', opacity: 0.9 },
    'quantum-grid': { ...base, backgroundImage: grid, backgroundSize: '7px 7px', transform: 'rotate(45deg) scale(1.6)' },
    'deep-space': { ...base, backgroundImage: 'radial-gradient(1px 1px at 20% 30%, var(--ink) 50%, transparent), radial-gradient(1px 1px at 70% 60%, var(--ink) 50%, transparent), radial-gradient(1px 1px at 45% 80%, var(--accent) 50%, transparent), radial-gradient(1px 1px at 85% 20%, var(--ink) 50%, transparent)', opacity: 0.8 },
    'digital-rain': { ...base, backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 6px, color-mix(in srgb, var(--accent) 40%, transparent) 6px 7px, transparent 7px 14px)', maskImage: 'linear-gradient(180deg, transparent, #000 40%, transparent)' },
    'aurora': { ...base, backgroundImage: 'radial-gradient(70% 60% at 40% 0%, color-mix(in srgb, var(--accent) 40%, transparent), transparent 70%)' },
    'minimal': { ...base, backgroundImage: 'linear-gradient(90deg, transparent, var(--accent) 50%, transparent)', backgroundSize: '100% 1px', backgroundRepeat: 'no-repeat', backgroundPosition: '0 50%' },
    'dark-matter': { ...base, backgroundImage: 'radial-gradient(circle at 50% 50%, transparent 30%, color-mix(in srgb, var(--accent) 22%, transparent) 38%, transparent 46%)' },
  };
  return <span style={styles[env]} aria-hidden />;
}

export function VisualSettings() {
  // Lazy initialisers: this panel only ever mounts inside the (client-only)
  // settings dialog, so the stored preference is available on first render.
  const [fx, setFx] = useState<FxPrefs>(() => (typeof window === 'undefined' ? DEFAULT_FX : readFx()));
  const [density, setDensity] = useState<Density>(() => {
    try {
      const d = localStorage.getItem(DENSITY_KEY);
      return d === 'compact' || d === 'spacious' ? d : 'comfortable';
    } catch {
      return 'comfortable';
    }
  });

  // Stay in sync if another tab (or the reset button in Appearance) changes
  // the preference while this panel is open.
  useEffect(() => {
    const onChange = () => setFx(readFx());
    window.addEventListener('fx:change', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('fx:change', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const set = (patch: Partial<FxPrefs>) => setFx(updateFx(patch));

  const setLayout = (d: Density) => {
    setDensity(d);
    applyDensity(d);
    clearTemplateMark();
    try { localStorage.setItem(DENSITY_KEY, d); } catch { /* ignore */ }
  };

  return (
    <div className="space-y-8">
      {/* Live preview — the user's real preset, driven by the same event chain. */}
      <div className="fx-glass fx-glass--lg relative flex items-center gap-5 overflow-hidden p-5">
        <AICore state="idle" size={132} className="flex-shrink-0" />
        <div className="min-w-0">
          <p className="fx-label mb-1.5">Intelligence core · live</p>
          <p className="text-[15px] font-semibold text-[var(--ink)]">{CORE_PRESETS.find((p) => p.key === fx.core)?.label}</p>
          <p className={`${help} mt-1`}>{CORE_PRESETS.find((p) => p.key === fx.core)?.blurb}</p>
          <p className={`${help} mt-2`}>
            Changes apply instantly across the whole app and are saved on this device.
          </p>
        </div>
      </div>

      {/* 3D core */}
      <section>
        <p className={heading}>3D Intelligence Core</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CORE_PRESETS.map((p) => (
            <button key={p.key} type="button" onClick={() => set({ core: p.key })} data-selected={fx.core === p.key} className="fx-tile" aria-pressed={fx.core === p.key}>
              <span className="fx-tile__swatch"><PresetGlyph preset={p.key} /></span>
              <span className="fx-tile__title">{p.label}</span>
              <span className="fx-tile__blurb">{p.blurb}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className={heading}>Particle density</p>
            <Seg value={fx.particles} label="Particle density" onChange={(v) => set({ particles: v })} options={[{ key: 'low', label: 'Low' }, { key: 'medium', label: 'Medium' }, { key: 'high', label: 'High' }]} />
            <p className={`${help} mt-1.5`}>Phones automatically run one tier lower.</p>
          </div>
          <div>
            <p className={heading}>Glow</p>
            <Range value={fx.glow} label="Glow intensity" onChange={(v) => set({ glow: v })} />
            <p className={`${help} mt-1.5`}>Ambient bleed, halos and edge light. 0 is a clean instrument panel.</p>
          </div>
        </div>
        <div className="mt-4">
          <Toggle on={fx.webgl} onChange={(v) => set({ webgl: v })} label="3D rendering" hint="Off uses the CSS core everywhere and opens no WebGL contexts." />
        </div>
      </section>

      {/* Environment */}
      <section>
        <p className={heading}>Environment</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ENVIRONMENTS.map((e) => (
            <button key={e.key} type="button" onClick={() => set({ environment: e.key })} data-selected={fx.environment === e.key} className="fx-tile" aria-pressed={fx.environment === e.key}>
              <span className="fx-tile__swatch"><EnvSwatch env={e.key} /></span>
              <span className="fx-tile__title">{e.label}</span>
              <span className="fx-tile__blurb">{e.blurb}</span>
            </button>
          ))}
        </div>
        <div className="mt-4">
          <p className={heading}>Depth</p>
          <Range value={fx.depth} label="Depth intensity" onChange={(v) => set({ depth: v })} />
          <p className={`${help} mt-1.5`}>Parallax and hover elevation. Lower is flatter and calmer.</p>
        </div>
      </section>

      {/* Animation */}
      <section>
        <p className={heading}>Animation</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className={heading}>Ambient motion</p>
            <Seg value={fx.motion} label="Ambient motion" onChange={(v) => set({ motion: v })} options={[{ key: 'off', label: 'Off' }, { key: 'calm', label: 'Calm' }, { key: 'normal', label: 'Normal' }, { key: 'lively', label: 'Lively' }]} />
            <p className={`${help} mt-1.5`}>Off stops the core, the grid and every drift — the visuals stay, they hold still.</p>
          </div>
          <div>
            <p className={heading}>Transition speed</p>
            <Seg value={fx.speed} label="Transition speed" onChange={(v) => set({ speed: v })} options={[{ key: 'slow', label: 'Slow' }, { key: 'normal', label: 'Normal' }, { key: 'fast', label: 'Fast' }]} />
            <p className={`${help} mt-1.5`}>Every reveal, hover and panel transition scales together.</p>
          </div>
        </div>
        <div className="mt-4">
          <Toggle on={fx.hover} onChange={(v) => set({ hover: v })} label="Hover effects" hint="Lift, sheen and press feedback on interactive surfaces." />
        </div>
      </section>

      {/* Layout + accessibility */}
      <section>
        <p className={heading}>Layout</p>
        <Seg value={density} label="Layout density" onChange={setLayout} options={[{ key: 'compact', label: 'Compact' }, { key: 'comfortable', label: 'Comfortable' }, { key: 'spacious', label: 'Spacious' }]} />
        <p className={`${help} mt-1.5`}>Spacing and control size across the workspace.</p>
        <div className="mt-4">
          <Toggle on={fx.contrast} onChange={(v) => set({ contrast: v })} label="High contrast edges" hint="Stronger borders and grid lines for readability." />
        </div>
        <p className={`${help} mt-3`}>
          Your operating system&apos;s <span className="text-[var(--ink-2)]">reduce motion</span> setting is always respected, regardless of the choices above.
        </p>
      </section>

      <div className="flex items-center justify-between border-t border-[var(--line)] pt-4">
        <p className={help}>Preferences are stored on this device only.</p>
        <button type="button" onClick={() => setFx(resetFx())} className="fx-press rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-2)] hover:bg-[var(--fill)]">
          Reset visual system
        </button>
      </div>
    </div>
  );
}
