import { describe, it, expect, beforeEach } from 'vitest';
import {
  ACCENTS,
  ACCENT_KEY,
  CODE_FONT_KEY,
  CODE_FONT_OPTIONS,
  FONT_KEY,
  FONT_OPTIONS,
  TEXT_SIZE_KEY,
  applyAccent,
} from '@/components/layout/AccentPicker';
import {
  APP_TEMPLATES,
  DENSITY_KEY,
  TEMPLATES_BY_KEY,
  TEMPLATE_KEY,
  THEME_KEY,
  applyTemplate,
  templateTheme,
  clearTemplateMark,
  currentTemplate,
} from './appTemplates';
import { SURFACES } from './surfaces';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  document.documentElement.removeAttribute('style');
});

describe('the template catalogue', () => {
  it('ships more than 50 templates', () => {
    expect(APP_TEMPLATES.length).toBeGreaterThan(50);
  });

  it('gives every template a unique key', () => {
    const keys = APP_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every template a name and a description', () => {
    for (const t of APP_TEMPLATES) {
      expect(t.label.length, t.key).toBeGreaterThan(2);
      expect(t.description.length, t.key).toBeGreaterThan(10);
    }
  });

  it('only references settings that actually exist', () => {
    // A typo here would apply a template that silently does nothing.
    const fonts = new Set(FONT_OPTIONS.map((f) => f.key));
    const codeFonts = new Set(CODE_FONT_OPTIONS.map((f) => f.key));
    for (const t of APP_TEMPLATES) {
      expect(ACCENTS[t.accent], `${t.key} accent`).toBeDefined();
      expect(fonts.has(t.font), `${t.key} font`).toBe(true);
      expect(codeFonts.has(t.codeFont), `${t.key} codeFont`).toBe(true);
      expect(SURFACES[t.surface], `${t.key} surface`).toBeDefined();
      expect(['small', 'medium', 'large']).toContain(t.textSize);
      expect(['compact', 'comfortable', 'spacious']).toContain(t.density);
    }
  });

  it('offers both light and dark looks', () => {
    const light = APP_TEMPLATES.filter((t) => templateTheme(t) === 'light').length;
    expect(light).toBeGreaterThan(5);
    expect(APP_TEMPLATES.length - light).toBeGreaterThan(5);
  });

  it('is not the same look over and over', () => {
    const combos = APP_TEMPLATES.map(
      (t) => `${t.surface}|${t.accent}|${t.font}|${t.codeFont}|${t.textSize}|${t.density}`
    );
    expect(new Set(combos).size).toBe(combos.length);
  });
});

describe('applying a template', () => {
  it('puts the theme and density on the document', () => {
    applyTemplate('daylight');
    const t = TEMPLATES_BY_KEY.daylight;
    expect(document.documentElement.classList.contains(templateTheme(t))).toBe(true);
    expect(document.documentElement.classList.contains(`density-${t.density}`)).toBe(true);
  });

  it('sets the accent CSS variables', () => {
    applyTemplate('terminal');
    const expected = ACCENTS[TEMPLATES_BY_KEY.terminal.accent].vars['--accent'];
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe(expected);
  });

  it('writes every underlying setting, not just its own marker', () => {
    // This is what keeps the Appearance controls honest after a template is
    // applied — they read these keys, not the template.
    applyTemplate('midnight');
    const t = TEMPLATES_BY_KEY.midnight;
    expect(localStorage.getItem(TEMPLATE_KEY)).toBe('midnight');
    expect(localStorage.getItem(THEME_KEY)).toBe(templateTheme(t));
    expect(localStorage.getItem(ACCENT_KEY)).toBe(t.accent);
    expect(localStorage.getItem(FONT_KEY)).toBe(t.font);
    expect(localStorage.getItem(CODE_FONT_KEY)).toBe(t.codeFont);
    expect(localStorage.getItem(TEXT_SIZE_KEY)).toBe(t.textSize);
    expect(localStorage.getItem(DENSITY_KEY)).toBe(t.density);
  });

  it('replaces the previous template rather than stacking on it', () => {
    applyTemplate('terminal');
    applyTemplate('paper');
    const root = document.documentElement;
    expect(root.classList.contains('light')).toBe(true);
    expect(root.classList.contains('dark')).toBe(false);
    expect(root.classList.contains('density-spacious')).toBe(true);
    expect(root.classList.contains('density-compact')).toBe(false);
  });

  it('every template applies without error', () => {
    for (const t of APP_TEMPLATES) {
      expect(applyTemplate(t.key), t.key).not.toBeNull();
      expect(localStorage.getItem(ACCENT_KEY), t.key).toBe(t.accent);
    }
  });

  it('ignores an unknown key instead of half-applying', () => {
    applyTemplate('midnight');
    expect(applyTemplate('does-not-exist')).toBeNull();
    expect(localStorage.getItem(TEMPLATE_KEY)).toBe('midnight');
  });
});

describe('the template marker', () => {
  it('reports nothing before a template is chosen', () => {
    expect(currentTemplate()).toBe('');
  });

  it('reports the applied template', () => {
    applyTemplate('forest');
    expect(currentTemplate()).toBe('forest');
  });

  it('clears when an individual setting is changed by hand', () => {
    // The look is no longer that template, and Settings must not claim it is.
    applyTemplate('forest');
    clearTemplateMark();
    expect(currentTemplate()).toBe('');
    // Clearing the marker must not undo the look itself.
    expect(localStorage.getItem(ACCENT_KEY)).toBe(TEMPLATES_BY_KEY.forest.accent);
  });
});


describe('a template changes the whole app, not just the accent', () => {
  const SURFACE_VARS = ['--base', '--elevated', '--panel', '--ink', '--ink-3', '--line', '--fill'];

  it('sets the surface palette, not only accent variables', () => {
    // The original bug this fixes: swapping --accent recoloured buttons and
    // left the page background, panels, borders and text exactly as before,
    // so every dark template looked like the same app in a different hat.
    applyTemplate('forest');
    const style = document.documentElement.style;
    for (const v of SURFACE_VARS) {
      expect(style.getPropertyValue(v), v).not.toBe('');
    }
  });

  it('gives different surfaces genuinely different backgrounds', () => {
    applyTemplate('terminal');
    const black = document.documentElement.style.getPropertyValue('--base');
    applyTemplate('boardroom');
    const navy = document.documentElement.style.getPropertyValue('--base');
    applyTemplate('paper');
    const paper = document.documentElement.style.getPropertyValue('--base');
    expect(new Set([black, navy, paper]).size).toBe(3);
  });

  it('stores the full palette so the pre-paint boot script can restore it', () => {
    // app/layout.tsx re-applies every --var it finds under this key before
    // first paint. If only accent vars were stored the surface would flash
    // back to the default on every reload.
    applyTemplate('forest');
    const stored = JSON.parse(localStorage.getItem('close_ai_accent_vars') || '{}');
    for (const v of SURFACE_VARS) {
      expect(stored[v], v).toBeTruthy();
    }
    expect(stored['--accent']).toBeTruthy();
  });

  it('keeps the surface when the accent is changed afterwards', () => {
    // applyAccent merges rather than replaces, so hand-picking an accent on
    // top of a template does not silently drop the surface on next reload.
    applyTemplate('forest');
    const base = JSON.parse(localStorage.getItem('close_ai_accent_vars') || '{}')['--base'];
    applyAccent('pink');
    const after = JSON.parse(localStorage.getItem('close_ai_accent_vars') || '{}');
    expect(after['--base']).toBe(base);
    expect(after['--accent']).toBe(ACCENTS.pink.vars['--accent']);
  });

  it('lets the accent win where a surface and accent overlap', () => {
    applyTemplate('terminal');
    expect(document.documentElement.style.getPropertyValue('--accent'))
      .toBe(ACCENTS[TEMPLATES_BY_KEY.terminal.accent].vars['--accent']);
  });

  it('uses a spread of surfaces rather than one dark and one light', () => {
    expect(new Set(APP_TEMPLATES.map((t) => t.surface)).size).toBeGreaterThan(8);
  });
});
