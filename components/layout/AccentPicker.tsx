'use client';

import { useState, useEffect, useRef } from 'react';

type Accent = { label: string; vars: Record<string, string> };

export const ACCENTS: Record<string, Accent> = {
  red:      { label: 'Red',      vars: { '--accent': '#f87171', '--accent-strong': '#dc2626', '--accent-fg': '#f87171', '--grad-from': '#fca5a5', '--grad-mid': '#f87171', '--grad-to': '#ef4444' } },
  crimson:  { label: 'Crimson',  vars: { '--accent': '#ef4444', '--accent-strong': '#991b1b', '--accent-fg': '#ef4444', '--grad-from': '#f87171', '--grad-mid': '#ef4444', '--grad-to': '#b91c1c' } },
  rose:     { label: 'Rose',     vars: { '--accent': '#fb7185', '--accent-strong': '#e11d48', '--accent-fg': '#fb7185', '--grad-from': '#fda4af', '--grad-mid': '#fb7185', '--grad-to': '#f43f5e' } },
  coral:    { label: 'Coral',    vars: { '--accent': '#fb6f6f', '--accent-strong': '#dc4848', '--accent-fg': '#fb6f6f', '--grad-from': '#ffa07a', '--grad-mid': '#fb6f6f', '--grad-to': '#f04848' } },
  orange:   { label: 'Orange',   vars: { '--accent': '#fb923c', '--accent-strong': '#ea580c', '--accent-fg': '#fb923c', '--grad-from': '#fdba74', '--grad-mid': '#fb923c', '--grad-to': '#f97316' } },
  bronze:   { label: 'Bronze',   vars: { '--accent': '#d97706', '--accent-strong': '#92400e', '--accent-fg': '#d97706', '--grad-from': '#fbbf24', '--grad-mid': '#d97706', '--grad-to': '#a16207' } },
  amber:    { label: 'Amber',    vars: { '--accent': '#fbbf24', '--accent-strong': '#d97706', '--accent-fg': '#fbbf24', '--grad-from': '#fcd34d', '--grad-mid': '#fbbf24', '--grad-to': '#f59e0b' } },
  yellow:   { label: 'Yellow',   vars: { '--accent': '#facc15', '--accent-strong': '#ca8a04', '--accent-fg': '#eab308', '--grad-from': '#fde047', '--grad-mid': '#facc15', '--grad-to': '#eab308' } },
  lime:     { label: 'Lime',     vars: { '--accent': '#a3e635', '--accent-strong': '#65a30d', '--accent-fg': '#84cc16', '--grad-from': '#bef264', '--grad-mid': '#a3e635', '--grad-to': '#84cc16' } },
  green:    { label: 'Green',    vars: { '--accent': '#4ade80', '--accent-strong': '#16a34a', '--accent-fg': '#4ade80', '--grad-from': '#86efac', '--grad-mid': '#4ade80', '--grad-to': '#22c55e' } },
  mint:     { label: 'Mint',     vars: { '--accent': '#6ee7b7', '--accent-strong': '#14b8a6', '--accent-fg': '#6ee7b7', '--grad-from': '#a7f3d0', '--grad-mid': '#6ee7b7', '--grad-to': '#34d399' } },
  emerald:  { label: 'Emerald',  vars: { '--accent': '#34d399', '--accent-strong': '#059669', '--accent-fg': '#34d399', '--grad-from': '#6ee7b7', '--grad-mid': '#34d399', '--grad-to': '#10b981' } },
  sage:     { label: 'Sage',     vars: { '--accent': '#86b487', '--accent-strong': '#4d7050', '--accent-fg': '#86b487', '--grad-from': '#b6d4b7', '--grad-mid': '#86b487', '--grad-to': '#5e8c60' } },
  teal:     { label: 'Teal',     vars: { '--accent': '#2dd4bf', '--accent-strong': '#0d9488', '--accent-fg': '#2dd4bf', '--grad-from': '#5eead4', '--grad-mid': '#2dd4bf', '--grad-to': '#14b8a6' } },
  ocean:    { label: 'Ocean',    vars: { '--accent': '#0e7490', '--accent-strong': '#155e75', '--accent-fg': '#22d3ee', '--grad-from': '#22d3ee', '--grad-mid': '#0891b2', '--grad-to': '#155e75' } },
  cyan:     { label: 'Cyan',     vars: { '--accent': '#22d3ee', '--accent-strong': '#0891b2', '--accent-fg': '#22d3ee', '--grad-from': '#67e8f9', '--grad-mid': '#22d3ee', '--grad-to': '#06b6d4' } },
  sky:      { label: 'Sky',      vars: { '--accent': '#38bdf8', '--accent-strong': '#0284c7', '--accent-fg': '#38bdf8', '--grad-from': '#7dd3fc', '--grad-mid': '#38bdf8', '--grad-to': '#0ea5e9' } },
  blue:     { label: 'Blue',     vars: { '--accent': '#60a5fa', '--accent-strong': '#2563eb', '--accent-fg': '#60a5fa', '--grad-from': '#93c5fd', '--grad-mid': '#60a5fa', '--grad-to': '#3b82f6' } },
  iris:     { label: 'Iris',     vars: { '--accent': '#7c83fd', '--accent-strong': '#4338ca', '--accent-fg': '#7c83fd', '--grad-from': '#a5b4fc', '--grad-mid': '#7c83fd', '--grad-to': '#4f46e5' } },
  indigo:   { label: 'Indigo',   vars: { '--accent': '#818cf8', '--accent-strong': '#4f46e5', '--accent-fg': '#818cf8', '--grad-from': '#a5b4fc', '--grad-mid': '#818cf8', '--grad-to': '#6366f1' } },
  violet:   { label: 'Violet',   vars: { '--accent': '#8b5cf6', '--accent-strong': '#6d28d9', '--accent-fg': '#8b5cf6', '--grad-from': '#a78bfa', '--grad-mid': '#8b5cf6', '--grad-to': '#7c3aed' } },
  purple:   { label: 'Purple',   vars: { '--accent': '#a78bfa', '--accent-strong': '#7c3aed', '--accent-fg': '#a78bfa', '--grad-from': '#c4b5fd', '--grad-mid': '#a78bfa', '--grad-to': '#8b5cf6' } },
  plum:     { label: 'Plum',     vars: { '--accent': '#9333ea', '--accent-strong': '#6b21a8', '--accent-fg': '#9333ea', '--grad-from': '#c084fc', '--grad-mid': '#9333ea', '--grad-to': '#7e22ce' } },
  fuchsia:  { label: 'Fuchsia',  vars: { '--accent': '#e879f9', '--accent-strong': '#c026d3', '--accent-fg': '#e879f9', '--grad-from': '#f0abfc', '--grad-mid': '#e879f9', '--grad-to': '#d946ef' } },
  magenta:  { label: 'Magenta',  vars: { '--accent': '#d946ef', '--accent-strong': '#a21caf', '--accent-fg': '#d946ef', '--grad-from': '#f0abfc', '--grad-mid': '#d946ef', '--grad-to': '#86198f' } },
  pink:     { label: 'Pink',     vars: { '--accent': '#f472b6', '--accent-strong': '#db2777', '--accent-fg': '#f472b6', '--grad-from': '#f9a8d4', '--grad-mid': '#f472b6', '--grad-to': '#ec4899' } },
  slate:    { label: 'Slate',    vars: { '--accent': '#94a3b8', '--accent-strong': '#475569', '--accent-fg': '#94a3b8', '--grad-from': '#cbd5e1', '--grad-mid': '#94a3b8', '--grad-to': '#64748b' } },
  graphite: { label: 'Graphite', vars: { '--accent': '#71717a', '--accent-strong': '#3f3f46', '--accent-fg': '#a1a1aa', '--grad-from': '#a1a1aa', '--grad-mid': '#71717a', '--grad-to': '#52525b' } },
};
export const ACCENT_KEY = 'close_ai_accent';

// The boot script in app/layout.tsx re-applies these vars BEFORE paint on every
// load, so the picked accent works even if this component never mounts.
export const ACCENT_VARS_KEY = 'close_ai_accent_vars';

export function applyAccent(name: string) {
  const a = ACCENTS[name];
  if (!a || typeof document === 'undefined') return;
  const root = document.documentElement;
  // 'important' priority so the picked accent wins over the theme defaults in
  // :root/.dark/.light no matter the cascade.
  Object.entries(a.vars).forEach(([k, v]) => root.style.setProperty(k, v, 'important'));
  try {
    localStorage.setItem(ACCENT_VARS_KEY, JSON.stringify(a.vars));
  } catch {
    /* ignore */
  }
}

// Read-aloud voice preference (stores the chosen SpeechSynthesis voice name).
export const VOICE_KEY = 'close_ai_voice';

// Chat message text size preference.
export const TEXT_SIZE_KEY = 'close_ai_text_size';
const TEXT_SIZES: Record<string, string> = { small: '14px', medium: '15px', large: '17px' };

export function applyTextSize(size: string) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--chat-font-size', TEXT_SIZES[size] || '15px');
}

// Interface font preference.
export const FONT_KEY = 'close_ai_font';
export const FONT_OPTIONS: { key: string; label: string }[] = [
  { key: 'default', label: 'Default · Geist' },
  { key: 'inter', label: 'Inter' },
  { key: 'space-grotesk', label: 'Space Grotesk' },
  { key: 'system', label: 'System' },
  { key: 'serif', label: 'Serif · Fraunces' },
  { key: 'playfair', label: 'Playfair Display' },
  { key: 'mono', label: 'Monospace · Geist' },
  { key: 'jetbrains', label: 'JetBrains Mono' },
];
const FONTS: Record<string, string> = {
  default: '',
  inter: 'var(--font-inter), system-ui, sans-serif',
  'space-grotesk': 'var(--font-space-grotesk), system-ui, sans-serif',
  system: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif: 'var(--font-serif), Georgia, "Times New Roman", serif',
  playfair: 'var(--font-playfair), Georgia, "Times New Roman", serif',
  mono: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace',
  jetbrains: 'var(--font-jetbrains), ui-monospace, SFMono-Regular, monospace',
};
export function applyFont(key: string) {
  if (typeof document === 'undefined') return;
  const f = FONTS[key];
  if (f) document.documentElement.style.setProperty('--app-font', f);
  else document.documentElement.style.removeProperty('--app-font');
}

// Code block font preference.
export const CODE_FONT_KEY = 'close_ai_code_font';
export const CODE_FONT_OPTIONS: { key: string; label: string }[] = [
  { key: 'default', label: 'Default · Geist Mono' },
  { key: 'jetbrains', label: 'JetBrains Mono' },
  { key: 'fira', label: 'Fira Code' },
  { key: 'sf-mono', label: 'SF Mono' },
  { key: 'cascadia', label: 'Cascadia Code' },
  { key: 'source-code', label: 'Source Code Pro' },
  { key: 'consolas', label: 'Consolas' },
];
const CODE_FONTS: Record<string, string> = {
  default: '',
  jetbrains: "var(--font-jetbrains), 'JetBrains Mono', ui-monospace, monospace",
  fira: "'Fira Code', ui-monospace, monospace",
  'sf-mono': "'SF Mono', ui-monospace, Menlo, monospace",
  cascadia: "'Cascadia Code', 'Cascadia Mono', ui-monospace, monospace",
  'source-code': "'Source Code Pro', ui-monospace, monospace",
  consolas: "Consolas, 'Courier New', monospace",
};
export function applyCodeFont(key: string) {
  if (typeof document === 'undefined') return;
  const f = CODE_FONTS[key];
  if (f) document.documentElement.style.setProperty('--code-font', f);
  else document.documentElement.style.removeProperty('--code-font');
}

export function AccentPicker() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('red');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem(ACCENT_KEY)) || 'red';
    if (ACCENTS[saved]) {
      applyAccent(saved);
      setCurrent(saved);
    }
    applyTextSize((typeof window !== 'undefined' && localStorage.getItem(TEXT_SIZE_KEY)) || 'medium');
    applyFont((typeof window !== 'undefined' && localStorage.getItem(FONT_KEY)) || 'default');
    applyCodeFont((typeof window !== 'undefined' && localStorage.getItem(CODE_FONT_KEY)) || 'default');
    // Density (compact/comfortable/spacious) — applied as a class on <html>
    // so CSS variables can react to it via .density-* selectors.
    if (typeof document !== 'undefined') {
      const d =
        (typeof window !== 'undefined' && localStorage.getItem('close_ai_density')) || 'comfortable';
      const root = document.documentElement;
      root.classList.remove('density-compact', 'density-comfortable', 'density-spacious');
      root.classList.add(`density-${d}`);
    }
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const pick = (name: string) => {
    applyAccent(name);
    setCurrent(name);
    try {
      localStorage.setItem(ACCENT_KEY, name);
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Accent color"
        aria-label="Accent color"
        className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors"
      >
        <span
          className="w-4 h-4 rounded-full ring-1 ring-black/10"
          style={{ background: ACCENTS[current]?.vars['--accent'] }}
        />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 p-2.5 rounded-xl bg-[var(--elevated)] border border-[var(--line-strong)] shadow-xl w-[252px] flex flex-wrap gap-2 max-h-72 overflow-y-auto">
          {Object.entries(ACCENTS).map(([name, a]) => (
            <button
              key={name}
              onClick={() => pick(name)}
              title={a.label}
              aria-label={a.label}
              className={`w-6 h-6 shrink-0 rounded-full transition-transform hover:scale-110 ${
                current === name ? 'ring-2 ring-offset-2 ring-offset-[var(--elevated)] ring-[var(--ink-2)]' : ''
              }`}
              style={{ background: a.vars['--accent'] }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
