'use client';

/**
 * App templates — one-click looks for the whole interface.
 *
 * A template is not a new theming system. It is a named preset over the
 * settings that already exist: theme, accent, interface font, code font, text
 * size and density. Picking one writes exactly the same localStorage keys the
 * individual controls read, so Appearance keeps showing the truth afterwards
 * and the user can still adjust any single dial by hand.
 *
 * That constraint is deliberate. Anything a template can do, the user could
 * already have done manually — templates just save them the twenty clicks.
 */

import {
  ACCENTS,
  ACCENT_KEY,
  ACCENT_VARS_KEY,
  CODE_FONT_KEY,
  FONT_KEY,
  TEXT_SIZE_KEY,
  applyCodeFont,
  applyFont,
  applyTextSize,
} from '@/components/layout/AccentPicker';
import { SURFACES } from '@/lib/surfaces';

export const TEMPLATE_KEY = 'close_ai_template';
export const SURFACE_KEY = 'close_ai_surface';
export const DENSITY_KEY = 'close_ai_density';
export const THEME_KEY = 'theme';

export type AppTemplate = {
  key: string;
  label: string;
  /** One line on what this look is for — shown under the name in Settings. */
  description: string;
  /**
   * The surface palette: background, panels, borders and text tiers. This is
   * what makes templates change the WHOLE app rather than just recolouring
   * buttons — see lib/surfaces.
   */
  surface: string;
  accent: string;
  font: string;
  codeFont: string;
  textSize: 'small' | 'medium' | 'large';
  density: 'compact' | 'comfortable' | 'spacious';
};

/** Light or dark follows from the surface — they can never disagree. */
export function templateTheme(t: AppTemplate): 'light' | 'dark' {
  return SURFACES[t.surface]?.mode ?? 'dark';
}

/** Density is a class on <html> so CSS variables can react via .density-*. */
export function applyDensity(d: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('density-compact', 'density-comfortable', 'density-spacious');
  const next = d === 'compact' || d === 'spacious' ? d : 'comfortable';
  root.classList.add(`density-${next}`);
}

/** Light/dark is a class on <html>, matching the pre-paint boot script. */
export function applyTheme(t: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const next = t === 'light' ? 'light' : 'dark';
  root.classList.remove('light', 'dark');
  root.classList.add(next);
}

export const APP_TEMPLATES: AppTemplate[] = [
  // ── Everyday ──────────────────────────────────────────────────
  { key: 'default', label: 'Close AI Default', description: 'The original look - warm red on true black.', surface: 'black', accent: 'red', font: 'default', codeFont: 'default', textSize: 'medium', density: 'comfortable' },
  { key: 'daylight', label: 'Daylight', description: 'Clean white light mode for bright rooms.', surface: 'snow', accent: 'blue', font: 'inter', codeFont: 'jetbrains', textSize: 'medium', density: 'comfortable' },
  { key: 'midnight', label: 'Midnight', description: 'Deep navy with a cool indigo accent.', surface: 'navy', accent: 'indigo', font: 'inter', codeFont: 'jetbrains', textSize: 'medium', density: 'comfortable' },
  { key: 'paper', label: 'Paper', description: 'Warm off-white and serif - reads like print.', surface: 'paper', accent: 'graphite', font: 'serif', codeFont: 'source-code', textSize: 'large', density: 'spacious' },
  { key: 'graphite', label: 'Graphite', description: 'Neutral charcoal, nothing competing for attention.', surface: 'charcoal', accent: 'graphite', font: 'system', codeFont: 'sf-mono', textSize: 'medium', density: 'comfortable' },
  { key: 'slate', label: 'Slate', description: 'Cool blue-grey surfaces, easy all day.', surface: 'slate', accent: 'sky', font: 'inter', codeFont: 'jetbrains', textSize: 'medium', density: 'comfortable' },

  // ── Focus ─────────────────────────────────────────────────────
  { key: 'deep-focus', label: 'Deep Focus', description: 'Forest surfaces, muted sage, generous spacing.', surface: 'forest', accent: 'sage', font: 'inter', codeFont: 'jetbrains', textSize: 'medium', density: 'spacious' },
  { key: 'minimal', label: 'Minimal', description: 'Black and slate, compact - maximum content per screen.', surface: 'black', accent: 'slate', font: 'system', codeFont: 'sf-mono', textSize: 'small', density: 'compact' },
  { key: 'zen', label: 'Zen', description: 'Sage light with airy spacing for long sessions.', surface: 'sage', accent: 'mint', font: 'inter', codeFont: 'source-code', textSize: 'large', density: 'spacious' },
  { key: 'quiet', label: 'Quiet', description: 'Low-contrast linen. Easy on tired eyes.', surface: 'linen', accent: 'sage', font: 'serif', codeFont: 'consolas', textSize: 'medium', density: 'spacious' },
  { key: 'monochrome', label: 'Monochrome', description: 'Grey everything. Colour only where it means something.', surface: 'charcoal', accent: 'slate', font: 'mono', codeFont: 'default', textSize: 'medium', density: 'compact' },
  { key: 'solitude', label: 'Solitude', description: 'Midnight ink, nothing bright anywhere.', surface: 'ink', accent: 'graphite', font: 'inter', codeFont: 'sf-mono', textSize: 'medium', density: 'spacious' },

  // ── Developer ─────────────────────────────────────────────────
  { key: 'terminal', label: 'Terminal', description: 'Green on true black, monospace throughout.', surface: 'black', accent: 'green', font: 'jetbrains', codeFont: 'jetbrains', textSize: 'small', density: 'compact' },
  { key: 'ide-dark', label: 'IDE Dark', description: 'Editor-like: slate surfaces, blue accent, tight rows.', surface: 'slate', accent: 'blue', font: 'jetbrains', codeFont: 'jetbrains', textSize: 'small', density: 'compact' },
  { key: 'code-review', label: 'Code Review', description: 'Light, dense, monospaced - built for reading diffs.', surface: 'snow', accent: 'iris', font: 'mono', codeFont: 'fira', textSize: 'small', density: 'compact' },
  { key: 'hacker', label: 'Hacker', description: 'Lime on black. Unapologetically retro.', surface: 'black', accent: 'lime', font: 'jetbrains', codeFont: 'cascadia', textSize: 'small', density: 'compact' },
  { key: 'debug', label: 'Debug', description: 'Amber warning tones, compact, mono everywhere.', surface: 'charcoal', accent: 'amber', font: 'mono', codeFont: 'cascadia', textSize: 'small', density: 'compact' },
  { key: 'notebook', label: 'Notebook', description: 'Light data-science look with a teal accent.', surface: 'mist', accent: 'teal', font: 'inter', codeFont: 'source-code', textSize: 'medium', density: 'comfortable' },
  { key: 'matrix', label: 'Matrix', description: 'Deep teal surfaces, emerald text accents.', surface: 'teal', accent: 'emerald', font: 'jetbrains', codeFont: 'jetbrains', textSize: 'small', density: 'compact' },
  { key: 'dracula', label: 'Dracula', description: 'Plum surfaces with a violet glow.', surface: 'plum', accent: 'violet', font: 'jetbrains', codeFont: 'fira', textSize: 'small', density: 'compact' },

  // ── Professional ──────────────────────────────────────────────
  { key: 'boardroom', label: 'Boardroom', description: 'Navy and Playfair. Formal without being stiff.', surface: 'navy', accent: 'blue', font: 'playfair', codeFont: 'consolas', textSize: 'medium', density: 'comfortable' },
  { key: 'consultant', label: 'Consultant', description: 'Cool mist, ocean blue, tidy spacing.', surface: 'mist', accent: 'ocean', font: 'inter', codeFont: 'sf-mono', textSize: 'medium', density: 'comfortable' },
  { key: 'legal', label: 'Legal', description: 'Linen and serif, spacious - for careful reading.', surface: 'linen', accent: 'bronze', font: 'serif', codeFont: 'consolas', textSize: 'large', density: 'spacious' },
  { key: 'finance', label: 'Finance', description: 'Slate surfaces, emerald, dense tabular feel.', surface: 'slate', accent: 'emerald', font: 'system', codeFont: 'sf-mono', textSize: 'small', density: 'compact' },
  { key: 'executive', label: 'Executive', description: 'Espresso and Playfair. Understated authority.', surface: 'espresso', accent: 'bronze', font: 'playfair', codeFont: 'source-code', textSize: 'medium', density: 'spacious' },
  { key: 'agency', label: 'Agency', description: 'Plum surfaces, violet accent, studio energy.', surface: 'plum', accent: 'violet', font: 'space-grotesk', codeFont: 'jetbrains', textSize: 'medium', density: 'comfortable' },
  { key: 'clinical', label: 'Clinical', description: 'Snow-white and precise. Nothing decorative.', surface: 'snow', accent: 'cyan', font: 'inter', codeFont: 'sf-mono', textSize: 'medium', density: 'comfortable' },
  { key: 'archive', label: 'Archive', description: 'Paper and slate, built for long documents.', surface: 'paper', accent: 'slate', font: 'serif', codeFont: 'source-code', textSize: 'large', density: 'spacious' },

  // ── Creative ──────────────────────────────────────────────────
  { key: 'sunset', label: 'Sunset', description: 'Espresso surfaces, orange into coral.', surface: 'espresso', accent: 'orange', font: 'space-grotesk', codeFont: 'fira', textSize: 'medium', density: 'spacious' },
  { key: 'sunrise', label: 'Sunrise', description: 'Linen and amber. Morning-shift energy.', surface: 'linen', accent: 'amber', font: 'space-grotesk', codeFont: 'fira', textSize: 'medium', density: 'comfortable' },
  { key: 'neon', label: 'Neon', description: 'Fuchsia on true black. Loud on purpose.', surface: 'black', accent: 'fuchsia', font: 'space-grotesk', codeFont: 'cascadia', textSize: 'medium', density: 'comfortable' },
  { key: 'synthwave', label: 'Synthwave', description: 'Plum and magenta. Retro-future.', surface: 'plum', accent: 'magenta', font: 'jetbrains', codeFont: 'cascadia', textSize: 'medium', density: 'comfortable' },
  { key: 'bubblegum', label: 'Bubblegum', description: 'Blush surfaces, pink accent, roomy.', surface: 'blush', accent: 'pink', font: 'space-grotesk', codeFont: 'fira', textSize: 'large', density: 'spacious' },
  { key: 'candy', label: 'Candy', description: 'Blush and rose, easy to read.', surface: 'blush', accent: 'rose', font: 'inter', codeFont: 'fira', textSize: 'large', density: 'comfortable' },
  { key: 'gallery', label: 'Gallery', description: 'Snow, spacious, Playfair - content as exhibit.', surface: 'snow', accent: 'plum', font: 'playfair', codeFont: 'source-code', textSize: 'large', density: 'spacious' },
  { key: 'studio', label: 'Studio', description: 'Charcoal with iris. Designer sans.', surface: 'charcoal', accent: 'iris', font: 'space-grotesk', codeFont: 'jetbrains', textSize: 'medium', density: 'spacious' },
  { key: 'vaporwave', label: 'Vaporwave', description: 'Plum surfaces, cyan and pink energy.', surface: 'plum', accent: 'cyan', font: 'space-grotesk', codeFont: 'cascadia', textSize: 'medium', density: 'spacious' },
  { key: 'noir', label: 'Noir', description: 'True black, crimson, serif. Film-still mood.', surface: 'black', accent: 'crimson', font: 'playfair', codeFont: 'consolas', textSize: 'medium', density: 'spacious' },

  // ── Nature ────────────────────────────────────────────────────
  { key: 'forest', label: 'Forest', description: 'Deep green surfaces. Calm and grounded.', surface: 'forest', accent: 'green', font: 'serif', codeFont: 'source-code', textSize: 'medium', density: 'spacious' },
  { key: 'ocean', label: 'Ocean', description: 'Cool teal depths.', surface: 'teal', accent: 'ocean', font: 'inter', codeFont: 'jetbrains', textSize: 'medium', density: 'comfortable' },
  { key: 'sky', label: 'Sky', description: 'Cool mist and open sky blue.', surface: 'mist', accent: 'sky', font: 'inter', codeFont: 'source-code', textSize: 'medium', density: 'spacious' },
  { key: 'desert', label: 'Desert', description: 'Linen, bronze, warm neutrals.', surface: 'linen', accent: 'bronze', font: 'serif', codeFont: 'consolas', textSize: 'medium', density: 'comfortable' },
  { key: 'glacier', label: 'Glacier', description: 'Snow and pale cyan. Cold and clear.', surface: 'snow', accent: 'cyan', font: 'inter', codeFont: 'sf-mono', textSize: 'medium', density: 'spacious' },
  { key: 'volcano', label: 'Volcano', description: 'Ash-red surfaces on near-black.', surface: 'crimsonDark', accent: 'crimson', font: 'space-grotesk', codeFont: 'cascadia', textSize: 'medium', density: 'comfortable' },
  { key: 'meadow', label: 'Meadow', description: 'Sage light with lime, generous spacing.', surface: 'sage', accent: 'lime', font: 'inter', codeFont: 'fira', textSize: 'large', density: 'spacious' },
  { key: 'lavender', label: 'Lavender', description: 'Blush surfaces, soft purple.', surface: 'blush', accent: 'purple', font: 'serif', codeFont: 'source-code', textSize: 'medium', density: 'spacious' },
  { key: 'moss', label: 'Moss', description: 'Forest surfaces, mint accents.', surface: 'forest', accent: 'mint', font: 'inter', codeFont: 'source-code', textSize: 'medium', density: 'comfortable' },
  { key: 'dusk', label: 'Dusk', description: 'Deep navy fading to violet.', surface: 'navy', accent: 'violet', font: 'inter', codeFont: 'jetbrains', textSize: 'medium', density: 'spacious' },

  // ── Accessibility ─────────────────────────────────────────────
  { key: 'large-print', label: 'Large Print', description: 'Bigger text and roomy lines throughout.', surface: 'snow', accent: 'blue', font: 'system', codeFont: 'consolas', textSize: 'large', density: 'spacious' },
  { key: 'high-contrast', label: 'High Contrast', description: 'Maximum separation between text and background.', surface: 'black', accent: 'yellow', font: 'system', codeFont: 'consolas', textSize: 'large', density: 'spacious' },
  { key: 'high-contrast-light', label: 'High Contrast Light', description: 'Pure white, dark text, strong borders.', surface: 'snow', accent: 'crimson', font: 'system', codeFont: 'consolas', textSize: 'large', density: 'spacious' },
  { key: 'night-shift', label: 'Night Shift', description: 'Warm espresso tones for late sessions.', surface: 'espresso', accent: 'amber', font: 'inter', codeFont: 'source-code', textSize: 'medium', density: 'comfortable' },
  { key: 'low-light', label: 'Low Light', description: 'Dim coral on deep dark, nothing harsh.', surface: 'ink', accent: 'coral', font: 'serif', codeFont: 'consolas', textSize: 'large', density: 'spacious' },
  { key: 'readable', label: 'Readable', description: 'Paper, serif, large, airy - long reading.', surface: 'paper', accent: 'teal', font: 'serif', codeFont: 'source-code', textSize: 'large', density: 'spacious' },

  // ── Compact ───────────────────────────────────────────────────
  { key: 'dense', label: 'Dense', description: 'Everything tightened. More on screen.', surface: 'charcoal', accent: 'cyan', font: 'system', codeFont: 'sf-mono', textSize: 'small', density: 'compact' },
  { key: 'cockpit', label: 'Cockpit', description: 'Slate dashboard with a sky accent.', surface: 'slate', accent: 'sky', font: 'inter', codeFont: 'jetbrains', textSize: 'small', density: 'compact' },
  { key: 'triage', label: 'Triage', description: 'Compact light for working a queue fast.', surface: 'snow', accent: 'crimson', font: 'system', codeFont: 'sf-mono', textSize: 'small', density: 'compact' },
  { key: 'ledger', label: 'Ledger', description: 'Mist surfaces, dense rows, tabular.', surface: 'mist', accent: 'emerald', font: 'mono', codeFont: 'sf-mono', textSize: 'small', density: 'compact' },

  // ── Character ─────────────────────────────────────────────────
  { key: 'royal', label: 'Royal', description: 'Deep plum and Playfair.', surface: 'plum', accent: 'plum', font: 'playfair', codeFont: 'source-code', textSize: 'medium', density: 'spacious' },
  { key: 'vintage', label: 'Vintage', description: 'Linen, bronze serif. Old paper, new app.', surface: 'linen', accent: 'yellow', font: 'playfair', codeFont: 'consolas', textSize: 'medium', density: 'spacious' },
  { key: 'arctic', label: 'Arctic', description: 'Icy cyan on deep teal.', surface: 'teal', accent: 'cyan', font: 'space-grotesk', codeFont: 'sf-mono', textSize: 'medium', density: 'comfortable' },
  { key: 'ember', label: 'Ember', description: 'Coral glow on espresso.', surface: 'espresso', accent: 'coral', font: 'space-grotesk', codeFont: 'fira', textSize: 'medium', density: 'comfortable' },
  { key: 'obsidian', label: 'Obsidian', description: 'True black with a graphite edge.', surface: 'black', accent: 'graphite', font: 'jetbrains', codeFont: 'jetbrains', textSize: 'small', density: 'compact' },
  { key: 'porcelain', label: 'Porcelain', description: 'Snow and rose. Delicate and clean.', surface: 'snow', accent: 'rose', font: 'serif', codeFont: 'source-code', textSize: 'medium', density: 'spacious' },
];

export const TEMPLATES_BY_KEY: Record<string, AppTemplate> = Object.fromEntries(
  APP_TEMPLATES.map((t) => [t.key, t])
);

/**
 * Apply a template and persist it as the individual settings it is made of.
 *
 * Writing every underlying key matters: the Appearance controls read those
 * keys, so without this a template would change the screen while the pickers
 * still showed the previous values.
 */
export function applyTemplate(key: string): AppTemplate | null {
  const t = TEMPLATES_BY_KEY[key];
  if (!t) return null;

  const surface = SURFACES[t.surface];
  const theme = templateTheme(t);
  const accentVars = ACCENTS[t.accent]?.vars ?? {};
  // Surface first, accent second: a template may share a surface with another
  // and differ only in accent, and the accent must win where they overlap.
  const vars = { ...(surface?.vars ?? {}), ...accentVars };

  applyTheme(theme);
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    // 'important' so inline vars beat the :root / .light blocks in globals.css.
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v, 'important'));
  }
  applyFont(t.font);
  applyCodeFont(t.codeFont);
  applyTextSize(t.textSize);
  applyDensity(t.density);

  try {
    // The whole palette goes in ACCENT_VARS_KEY because the pre-paint boot
    // script in app/layout.tsx already restores every `--var` it finds there.
    // Storing surfaces here means a template survives reload with no flash and
    // no change to the boot script.
    localStorage.setItem(ACCENT_VARS_KEY, JSON.stringify(vars));
    localStorage.setItem(TEMPLATE_KEY, t.key);
    localStorage.setItem(SURFACE_KEY, t.surface);
    localStorage.setItem(THEME_KEY, theme);
    localStorage.setItem(ACCENT_KEY, t.accent);
    localStorage.setItem(FONT_KEY, t.font);
    localStorage.setItem(CODE_FONT_KEY, t.codeFont);
    localStorage.setItem(TEXT_SIZE_KEY, t.textSize);
    localStorage.setItem(DENSITY_KEY, t.density);
  } catch {
    /* private mode / quota — the look still applied for this session */
  }
  return t;
}

/** The saved template key, or '' when the user has customised by hand. */
export function currentTemplate(): string {
  try {
    return localStorage.getItem(TEMPLATE_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Clear the "this is template X" marker.
 *
 * Called when any individual appearance control changes: the look is no longer
 * that template, and continuing to show it as selected would be a lie.
 */
export function clearTemplateMark() {
  try {
    localStorage.removeItem(TEMPLATE_KEY);
  } catch {
    /* ignore */
  }
}
