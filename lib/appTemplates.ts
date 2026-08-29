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
  ACCENT_KEY,
  CODE_FONT_KEY,
  FONT_KEY,
  TEXT_SIZE_KEY,
  applyAccent,
  applyCodeFont,
  applyFont,
  applyTextSize,
} from '@/components/layout/AccentPicker';

export const TEMPLATE_KEY = 'close_ai_template';
export const DENSITY_KEY = 'close_ai_density';
export const THEME_KEY = 'theme';

export type AppTemplate = {
  key: string;
  label: string;
  /** One line on what this look is for — shown under the name in Settings. */
  description: string;
  theme: 'light' | 'dark';
  accent: string;
  font: string;
  codeFont: string;
  textSize: 'small' | 'medium' | 'large';
  density: 'compact' | 'comfortable' | 'spacious';
};

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
  // ── Everyday ───────────────────────────────────────────────────────────────
  { key: 'default', label: 'Close AI Default', description: 'The original look — warm red on deep charcoal.', theme: 'dark', accent: 'red', font: 'default', codeFont: 'default', textSize: 'medium', density: 'comfortable' },
  { key: 'daylight', label: 'Daylight', description: 'Clean light mode for bright rooms.', theme: 'light', accent: 'blue', font: 'inter', codeFont: 'jetbrains', textSize: 'medium', density: 'comfortable' },
  { key: 'midnight', label: 'Midnight', description: 'Deep dark with a cool indigo accent.', theme: 'dark', accent: 'indigo', font: 'inter', codeFont: 'jetbrains', textSize: 'medium', density: 'comfortable' },
  { key: 'paper', label: 'Paper', description: 'Light and serif — reads like a printed page.', theme: 'light', accent: 'graphite', font: 'serif', codeFont: 'source-code', textSize: 'large', density: 'spacious' },
  { key: 'graphite', label: 'Graphite', description: 'Neutral greys, nothing competing for attention.', theme: 'dark', accent: 'graphite', font: 'system', codeFont: 'sf-mono', textSize: 'medium', density: 'comfortable' },

  // ── Focus ──────────────────────────────────────────────────────────────────
  { key: 'deep-focus', label: 'Deep Focus', description: 'Muted sage, generous spacing, nothing loud.', theme: 'dark', accent: 'sage', font: 'inter', codeFont: 'jetbrains', textSize: 'medium', density: 'spacious' },
  { key: 'minimal', label: 'Minimal', description: 'Slate on dark, compact — maximum content per screen.', theme: 'dark', accent: 'slate', font: 'system', codeFont: 'sf-mono', textSize: 'small', density: 'compact' },
  { key: 'zen', label: 'Zen', description: 'Soft mint and airy spacing for long thinking sessions.', theme: 'light', accent: 'mint', font: 'inter', codeFont: 'source-code', textSize: 'large', density: 'spacious' },
  { key: 'quiet', label: 'Quiet', description: 'Low-contrast sage on light. Easy on tired eyes.', theme: 'light', accent: 'sage', font: 'serif', codeFont: 'consolas', textSize: 'medium', density: 'spacious' },
  { key: 'monochrome', label: 'Monochrome', description: 'Grey everything. Colour only where it means something.', theme: 'dark', accent: 'slate', font: 'mono', codeFont: 'default', textSize: 'medium', density: 'compact' },

  // ── Developer ──────────────────────────────────────────────────────────────
  { key: 'terminal', label: 'Terminal', description: 'Green on black, monospace throughout.', theme: 'dark', accent: 'green', font: 'jetbrains', codeFont: 'jetbrains', textSize: 'small', density: 'compact' },
  { key: 'ide-dark', label: 'IDE Dark', description: 'Editor-like: blue accent, JetBrains code, tight rows.', theme: 'dark', accent: 'blue', font: 'jetbrains', codeFont: 'jetbrains', textSize: 'small', density: 'compact' },
  { key: 'code-review', label: 'Code Review', description: 'Light, dense, monospaced — built for reading diffs.', theme: 'light', accent: 'iris', font: 'mono', codeFont: 'fira', textSize: 'small', density: 'compact' },
  { key: 'hacker', label: 'Hacker', description: 'Lime on black. Unapologetically retro.', theme: 'dark', accent: 'lime', font: 'jetbrains', codeFont: 'cascadia', textSize: 'small', density: 'compact' },
  { key: 'debug', label: 'Debug', description: 'Amber warning tones, compact, mono everywhere.', theme: 'dark', accent: 'amber', font: 'mono', codeFont: 'cascadia', textSize: 'small', density: 'compact' },
  { key: 'notebook', label: 'Notebook', description: 'Light data-science look with a teal accent.', theme: 'light', accent: 'teal', font: 'inter', codeFont: 'source-code', textSize: 'medium', density: 'comfortable' },

  // ── Professional ───────────────────────────────────────────────────────────
  { key: 'boardroom', label: 'Boardroom', description: 'Navy and serif. Formal without being stiff.', theme: 'light', accent: 'blue', font: 'playfair', codeFont: 'consolas', textSize: 'medium', density: 'comfortable' },
  { key: 'consultant', label: 'Consultant', description: 'Ocean blue, crisp sans, tidy spacing.', theme: 'light', accent: 'ocean', font: 'inter', codeFont: 'sf-mono', textSize: 'medium', density: 'comfortable' },
  { key: 'legal', label: 'Legal', description: 'Serif on light, spacious — for careful reading.', theme: 'light', accent: 'bronze', font: 'serif', codeFont: 'consolas', textSize: 'large', density: 'spacious' },
  { key: 'finance', label: 'Finance', description: 'Emerald on dark, dense tables, tabular feel.', theme: 'dark', accent: 'emerald', font: 'system', codeFont: 'sf-mono', textSize: 'small', density: 'compact' },
  { key: 'executive', label: 'Executive', description: 'Graphite and Playfair. Understated authority.', theme: 'dark', accent: 'bronze', font: 'playfair', codeFont: 'source-code', textSize: 'medium', density: 'spacious' },
  { key: 'agency', label: 'Agency', description: 'Space Grotesk with a violet accent. Studio energy.', theme: 'dark', accent: 'violet', font: 'space-grotesk', codeFont: 'jetbrains', textSize: 'medium', density: 'comfortable' },

  // ── Creative ───────────────────────────────────────────────────────────────
  { key: 'sunset', label: 'Sunset', description: 'Orange into coral, warm and unhurried.', theme: 'dark', accent: 'orange', font: 'space-grotesk', codeFont: 'fira', textSize: 'medium', density: 'spacious' },
  { key: 'sunrise', label: 'Sunrise', description: 'Amber on light. Morning-shift energy.', theme: 'light', accent: 'amber', font: 'space-grotesk', codeFont: 'fira', textSize: 'medium', density: 'comfortable' },
  { key: 'neon', label: 'Neon', description: 'Fuchsia on black. Loud on purpose.', theme: 'dark', accent: 'fuchsia', font: 'space-grotesk', codeFont: 'cascadia', textSize: 'medium', density: 'comfortable' },
  { key: 'synthwave', label: 'Synthwave', description: 'Magenta and mono. 1984 called.', theme: 'dark', accent: 'magenta', font: 'jetbrains', codeFont: 'cascadia', textSize: 'medium', density: 'comfortable' },
  { key: 'bubblegum', label: 'Bubblegum', description: 'Pink on light, roomy and friendly.', theme: 'light', accent: 'pink', font: 'space-grotesk', codeFont: 'fira', textSize: 'large', density: 'spacious' },
  { key: 'candy', label: 'Candy', description: 'Rose and playful, easy to read.', theme: 'light', accent: 'rose', font: 'inter', codeFont: 'fira', textSize: 'large', density: 'comfortable' },
  { key: 'gallery', label: 'Gallery', description: 'Light, spacious, Playfair — content as exhibit.', theme: 'light', accent: 'plum', font: 'playfair', codeFont: 'source-code', textSize: 'large', density: 'spacious' },
  { key: 'studio', label: 'Studio', description: 'Iris on dark with a designer sans.', theme: 'dark', accent: 'iris', font: 'space-grotesk', codeFont: 'jetbrains', textSize: 'medium', density: 'spacious' },

  // ── Nature ─────────────────────────────────────────────────────────────────
  { key: 'forest', label: 'Forest', description: 'Deep green on dark. Calm and grounded.', theme: 'dark', accent: 'green', font: 'serif', codeFont: 'source-code', textSize: 'medium', density: 'spacious' },
  { key: 'ocean', label: 'Ocean', description: 'Cool teal depths.', theme: 'dark', accent: 'ocean', font: 'inter', codeFont: 'jetbrains', textSize: 'medium', density: 'comfortable' },
  { key: 'sky', label: 'Sky', description: 'Light and open, pale blue accent.', theme: 'light', accent: 'sky', font: 'inter', codeFont: 'source-code', textSize: 'medium', density: 'spacious' },
  { key: 'desert', label: 'Desert', description: 'Bronze and warm neutrals.', theme: 'light', accent: 'bronze', font: 'serif', codeFont: 'consolas', textSize: 'medium', density: 'comfortable' },
  { key: 'glacier', label: 'Glacier', description: 'Pale cyan on light. Cold and clear.', theme: 'light', accent: 'cyan', font: 'inter', codeFont: 'sf-mono', textSize: 'medium', density: 'spacious' },
  { key: 'volcano', label: 'Volcano', description: 'Crimson on near-black.', theme: 'dark', accent: 'crimson', font: 'space-grotesk', codeFont: 'cascadia', textSize: 'medium', density: 'comfortable' },
  { key: 'meadow', label: 'Meadow', description: 'Lime and light, generous spacing.', theme: 'light', accent: 'lime', font: 'inter', codeFont: 'fira', textSize: 'large', density: 'spacious' },
  { key: 'lavender', label: 'Lavender', description: 'Soft purple on light. Gentle contrast.', theme: 'light', accent: 'purple', font: 'serif', codeFont: 'source-code', textSize: 'medium', density: 'spacious' },

  // ── Accessibility & comfort ────────────────────────────────────────────────
  { key: 'large-print', label: 'Large Print', description: 'Bigger text and roomy lines throughout.', theme: 'light', accent: 'blue', font: 'system', codeFont: 'consolas', textSize: 'large', density: 'spacious' },
  { key: 'high-contrast', label: 'High Contrast', description: 'Maximum separation between text and background.', theme: 'dark', accent: 'yellow', font: 'system', codeFont: 'consolas', textSize: 'large', density: 'spacious' },
  { key: 'night-shift', label: 'Night Shift', description: 'Warm amber tones for late sessions.', theme: 'dark', accent: 'amber', font: 'inter', codeFont: 'source-code', textSize: 'medium', density: 'comfortable' },
  { key: 'low-light', label: 'Low Light', description: 'Dim coral on deep dark, nothing harsh.', theme: 'dark', accent: 'coral', font: 'serif', codeFont: 'consolas', textSize: 'large', density: 'spacious' },
  { key: 'readable', label: 'Readable', description: 'Serif, large, airy — built for long reading.', theme: 'light', accent: 'teal', font: 'serif', codeFont: 'source-code', textSize: 'large', density: 'spacious' },

  // ── Compact & power use ────────────────────────────────────────────────────
  { key: 'dense', label: 'Dense', description: 'Everything tightened. More on screen, less scrolling.', theme: 'dark', accent: 'cyan', font: 'system', codeFont: 'sf-mono', textSize: 'small', density: 'compact' },
  { key: 'cockpit', label: 'Cockpit', description: 'Compact dark with a sky accent. Dashboard feel.', theme: 'dark', accent: 'sky', font: 'inter', codeFont: 'jetbrains', textSize: 'small', density: 'compact' },
  { key: 'triage', label: 'Triage', description: 'Compact light for working through a queue fast.', theme: 'light', accent: 'crimson', font: 'system', codeFont: 'sf-mono', textSize: 'small', density: 'compact' },

  // ── Character ──────────────────────────────────────────────────────────────
  { key: 'royal', label: 'Royal', description: 'Deep plum and Playfair.', theme: 'dark', accent: 'plum', font: 'playfair', codeFont: 'source-code', textSize: 'medium', density: 'spacious' },
  { key: 'vintage', label: 'Vintage', description: 'Bronze serif on light. Old paper, new app.', theme: 'light', accent: 'yellow', font: 'playfair', codeFont: 'consolas', textSize: 'medium', density: 'spacious' },
  { key: 'arctic', label: 'Arctic', description: 'Icy cyan on dark.', theme: 'dark', accent: 'cyan', font: 'space-grotesk', codeFont: 'sf-mono', textSize: 'medium', density: 'comfortable' },
  { key: 'ember', label: 'Ember', description: 'Coral glow on charcoal.', theme: 'dark', accent: 'coral', font: 'space-grotesk', codeFont: 'fira', textSize: 'medium', density: 'comfortable' },
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

  applyTheme(t.theme);
  applyAccent(t.accent);
  applyFont(t.font);
  applyCodeFont(t.codeFont);
  applyTextSize(t.textSize);
  applyDensity(t.density);

  try {
    localStorage.setItem(TEMPLATE_KEY, t.key);
    localStorage.setItem(THEME_KEY, t.theme);
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
