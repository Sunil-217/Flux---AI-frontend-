import { describe, it, expect, beforeEach } from 'vitest';
import {
  ACCENTS,
  ACCENT_KEY,
  CODE_FONT_KEY,
  CODE_FONT_OPTIONS,
  FONT_KEY,
  FONT_OPTIONS,
  TEXT_SIZE_KEY,
} from '@/components/layout/AccentPicker';
import {
  APP_TEMPLATES,
  DENSITY_KEY,
  TEMPLATES_BY_KEY,
  TEMPLATE_KEY,
  THEME_KEY,
  applyTemplate,
  clearTemplateMark,
  currentTemplate,
} from './appTemplates';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  document.documentElement.removeAttribute('style');
});

describe('the template catalogue', () => {
  it('ships 50 templates', () => {
    expect(APP_TEMPLATES).toHaveLength(50);
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
      expect(['light', 'dark']).toContain(t.theme);
      expect(['small', 'medium', 'large']).toContain(t.textSize);
      expect(['compact', 'comfortable', 'spacious']).toContain(t.density);
    }
  });

  it('offers both light and dark looks', () => {
    const light = APP_TEMPLATES.filter((t) => t.theme === 'light').length;
    expect(light).toBeGreaterThan(5);
    expect(APP_TEMPLATES.length - light).toBeGreaterThan(5);
  });

  it('is not the same look fifty times over', () => {
    const combos = APP_TEMPLATES.map(
      (t) => `${t.theme}|${t.accent}|${t.font}|${t.codeFont}|${t.textSize}|${t.density}`
    );
    expect(new Set(combos).size).toBe(combos.length);
  });
});

describe('applying a template', () => {
  it('puts the theme and density on the document', () => {
    applyTemplate('daylight');
    const t = TEMPLATES_BY_KEY.daylight;
    expect(document.documentElement.classList.contains(t.theme)).toBe(true);
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
    expect(localStorage.getItem(THEME_KEY)).toBe(t.theme);
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

  it('every one of the fifty applies without error', () => {
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
