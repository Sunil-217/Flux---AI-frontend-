'use client';

/**
 * Surface palettes — the background, panel, border and text colours that make
 * one look genuinely different from another.
 *
 * Accents alone were never enough. Swapping --accent changes buttons and links
 * and leaves everything else identical, so every dark template looked like the
 * same app in a different hat. A template picks a SURFACE here as well, and the
 * whole window changes: page background, cards, dividers, bubbles, code blocks
 * and all four text tiers.
 *
 * These are the same variables globals.css defines for :root and .light — set
 * as inline styles on <html>, they win over both. The boot script in
 * app/layout.tsx re-applies whatever is stored before first paint, so a chosen
 * surface survives reload with no flash.
 */

export type Surface = {
  label: string;
  /** Which base theme class to pair with, for scrollbars and form controls. */
  mode: 'light' | 'dark';
  vars: Record<string, string>;
};

/** Dark palette from three anchors plus an overlay tint. */
function dark(
  label: string,
  base: string,
  elevated: string,
  panel: string,
  tint: string,
  ink: [string, string, string, string]
): Surface {
  return {
    label,
    mode: 'dark',
    vars: {
      '--base': base,
      '--panel': panel,
      '--elevated': elevated,
      '--fill': `rgba(${tint}, 0.05)`,
      '--fill-hover': `rgba(${tint}, 0.09)`,
      '--fill-strong': `rgba(${tint}, 0.07)`,
      '--line': `rgba(${tint}, 0.10)`,
      '--line-strong': `rgba(${tint}, 0.18)`,
      '--bubble': `rgba(${tint}, 0.06)`,
      '--code': `rgba(${tint}, 0.04)`,
      '--ink': ink[0],
      '--ink-2': ink[1],
      '--ink-3': ink[2],
      '--ink-4': ink[3],
    },
  };
}

/** Light palette. Overlays are darker-on-lighter, so the tint is an ink colour. */
function light(
  label: string,
  base: string,
  elevated: string,
  panel: string,
  tint: string,
  ink: [string, string, string, string]
): Surface {
  return {
    label,
    mode: 'light',
    vars: {
      '--base': base,
      '--panel': panel,
      '--elevated': elevated,
      '--fill': `rgba(${tint}, 0.05)`,
      '--fill-hover': `rgba(${tint}, 0.09)`,
      '--fill-strong': `rgba(${tint}, 0.07)`,
      '--line': `rgba(${tint}, 0.13)`,
      '--line-strong': `rgba(${tint}, 0.22)`,
      '--bubble': `rgba(${tint}, 0.06)`,
      '--code': `rgba(${tint}, 0.05)`,
      '--ink': ink[0],
      '--ink-2': ink[1],
      '--ink-3': ink[2],
      '--ink-4': ink[3],
    },
  };
}

export const SURFACES: Record<string, Surface> = {
  // ── Dark ───────────────────────────────────────────────────────────────────
  black: dark('True Black', '#000000', '#161618', 'rgba(10,10,12,0.72)', '255,255,255',
    ['#fafafa', '#d4d4d4', '#9a9a9a', '#6a6a6a']),
  charcoal: dark('Charcoal', '#141416', '#1e1e21', 'rgba(24,24,27,0.75)', '255,255,255',
    ['#f4f4f5', '#cfcfd4', '#96969e', '#6b6b73']),
  slate: dark('Slate', '#0f172a', '#1a2436', 'rgba(20,28,45,0.78)', '203,213,225',
    ['#f1f5f9', '#cbd5e1', '#94a3b8', '#64748b']),
  navy: dark('Deep Navy', '#0a1628', '#122036', 'rgba(12,24,42,0.8)', '186,209,239',
    ['#eef4fb', '#c7d8ec', '#8fa8c4', '#647c96']),
  forest: dark('Forest', '#0c1512', '#14201b', 'rgba(14,24,20,0.78)', '198,230,213',
    ['#eef7f2', '#c9e0d4', '#8fb0a1', '#647f73']),
  plum: dark('Plum', '#150f1c', '#201628', 'rgba(24,16,32,0.78)', '224,205,240',
    ['#f6f0fb', '#dccbe8', '#a795b5', '#7a6b85']),
  espresso: dark('Espresso', '#171210', '#221b18', 'rgba(28,20,17,0.78)', '238,220,205',
    ['#faf4ef', '#e0cec0', '#ab9a8c', '#7d7065']),
  ink: dark('Midnight Ink', '#080a12', '#101420', 'rgba(9,12,20,0.8)', '190,200,230',
    ['#f2f4fb', '#ccd3e6', '#939bb5', '#666d85']),
  crimsonDark: dark('Ash Red', '#160e0e', '#211616', 'rgba(26,14,14,0.78)', '242,208,208',
    ['#fbf1f1', '#e5cccc', '#b09494', '#816969']),
  teal: dark('Deep Teal', '#07171a', '#0f2328', 'rgba(8,24,28,0.78)', '190,232,240',
    ['#eef9fb', '#c5e2e8', '#8bb0b8', '#618087']),

  // ── Light ──────────────────────────────────────────────────────────────────
  paper: light('Warm Paper', '#faf9f5', '#fffefb', 'rgba(244,242,235,0.82)', '60,50,38',
    ['#2b2925', '#4b483f', '#6d695f', '#9b968a']),
  snow: light('Snow', '#ffffff', '#ffffff', 'rgba(250,250,252,0.9)', '17,24,39',
    ['#111827', '#1f2937', '#4b5563', '#9ca3af']),
  mist: light('Cool Mist', '#f6f8fb', '#ffffff', 'rgba(240,244,250,0.88)', '30,41,59',
    ['#0f172a', '#334155', '#64748b', '#94a3b8']),
  linen: light('Linen', '#f7f4ee', '#fffdf8', 'rgba(240,236,227,0.85)', '68,58,45',
    ['#332e26', '#544d41', '#7b7365', '#a8a08f']),
  sage: light('Sage', '#f3f7f3', '#fbfdfa', 'rgba(236,243,235,0.86)', '42,61,48',
    ['#203026', '#3d5445', '#647a6c', '#93a698']),
  blush: light('Blush', '#fdf6f6', '#fffbfb', 'rgba(250,240,240,0.86)', '72,44,48',
    ['#332326', '#553f43', '#7d6469', '#ad969a']),
};

export const SURFACE_KEYS = Object.keys(SURFACES);
