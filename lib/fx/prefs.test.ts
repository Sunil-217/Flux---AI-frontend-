import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_FX,
  FX_BOOT_SCRIPT,
  FX_KEY,
  applyFx,
  normalise,
  particleCount,
  readFx,
  resetFx,
  saveFx,
  updateFx,
} from './prefs';

/**
 * Every preference has to reach the DOM, or the Settings control that sets it
 * is decoration. These tests pin that contract, plus the boot script — which is
 * a string the browser runs before React exists, so it can only be tested by
 * executing it.
 */

const root = () => document.documentElement;

beforeEach(() => {
  localStorage.clear();
  root().removeAttribute('style');
  for (const k of Object.keys(root().dataset)) delete root().dataset[k];
});
afterEach(() => localStorage.clear());

describe('normalise', () => {
  it('returns defaults for garbage', () => {
    expect(normalise(null)).toEqual(DEFAULT_FX);
    expect(normalise('nope')).toEqual(DEFAULT_FX);
    expect(normalise({ core: 'not-a-preset', glow: 'loud', motion: 'maximum' })).toEqual(DEFAULT_FX);
  });

  it('clamps continuous values and keeps valid enums', () => {
    const p = normalise({ glow: 7, depth: -3, core: 'galaxy', environment: 'deep-space', particles: 'high', motion: 'calm', speed: 'fast', hover: false, webgl: false, contrast: true });
    expect(p.glow).toBe(1);
    expect(p.depth).toBe(0);
    expect(p.core).toBe('galaxy');
    expect(p.environment).toBe('deep-space');
    expect(p.particles).toBe('high');
    expect(p.motion).toBe('calm');
    expect(p.speed).toBe('fast');
    expect(p.hover).toBe(false);
    expect(p.webgl).toBe(false);
    expect(p.contrast).toBe(true);
  });
});

describe('applyFx', () => {
  it('writes every discrete choice as a data attribute CSS can select on', () => {
    applyFx({ ...DEFAULT_FX, core: 'reactor', environment: 'aurora', motion: 'lively', hover: false, webgl: false, contrast: true });
    expect(root().dataset.fxCore).toBe('reactor');
    expect(root().dataset.fxEnv).toBe('aurora');
    expect(root().dataset.fxMotion).toBe('lively');
    expect(root().dataset.fxHover).toBe('off');
    expect(root().dataset.fxWebgl).toBe('off');
    expect(root().dataset.fxContrast).toBe('on');
  });

  it('writes every continuous choice as a variable CSS multiplies by', () => {
    applyFx({ ...DEFAULT_FX, glow: 0.25, depth: 0.9, motion: 'calm', speed: 'slow' });
    expect(root().style.getPropertyValue('--fx-glow')).toBe('0.25');
    expect(root().style.getPropertyValue('--fx-depth')).toBe('0.90');
    expect(root().style.getPropertyValue('--fx-motion')).toBe('0.45');
    expect(root().style.getPropertyValue('--fx-speed')).toBe('1.60');
  });

  it('motion off drives the multiplier to zero', () => {
    applyFx({ ...DEFAULT_FX, motion: 'off' });
    expect(root().style.getPropertyValue('--fx-motion')).toBe('0.00');
  });
});

describe('persistence', () => {
  it('round-trips through localStorage', () => {
    saveFx({ ...DEFAULT_FX, core: 'lattice', glow: 0.1 });
    expect(readFx().core).toBe('lattice');
    expect(readFx().glow).toBe(0.1);
  });

  it('updateFx merges a patch onto what is stored', () => {
    saveFx({ ...DEFAULT_FX, core: 'cortex' });
    const next = updateFx({ glow: 0.3 });
    expect(next.core).toBe('cortex');
    expect(next.glow).toBe(0.3);
    expect(readFx()).toEqual(next);
  });

  it('resetFx restores every default', () => {
    saveFx({ ...DEFAULT_FX, core: 'galaxy', webgl: false });
    expect(resetFx()).toEqual(DEFAULT_FX);
    expect(readFx()).toEqual(DEFAULT_FX);
    expect(root().dataset.fxWebgl).toBe('on');
  });

  it('announces changes on the same tab', () => {
    let heard: unknown = null;
    const onChange = (e: Event) => { heard = (e as CustomEvent).detail; };
    window.addEventListener('fx:change', onChange);
    saveFx({ ...DEFAULT_FX, environment: 'minimal' });
    window.removeEventListener('fx:change', onChange);
    expect((heard as { environment: string }).environment).toBe('minimal');
  });
});

describe('boot script', () => {
  it('applies stored prefs to <html> exactly as applyFx would', () => {
    localStorage.setItem(FX_KEY, JSON.stringify({ ...DEFAULT_FX, core: 'singularity', environment: 'digital-rain', motion: 'calm', speed: 'fast', glow: 0.2, depth: 0.8, hover: false, webgl: false, contrast: true }));
    new Function(FX_BOOT_SCRIPT)();
    expect(root().dataset.fxCore).toBe('singularity');
    expect(root().dataset.fxEnv).toBe('digital-rain');
    expect(root().dataset.fxMotion).toBe('calm');
    expect(root().dataset.fxHover).toBe('off');
    expect(root().dataset.fxWebgl).toBe('off');
    expect(root().dataset.fxContrast).toBe('on');
    expect(root().style.getPropertyValue('--fx-glow')).toBe('0.2');
    expect(root().style.getPropertyValue('--fx-depth')).toBe('0.8');
    expect(root().style.getPropertyValue('--fx-motion')).toBe('0.45');
    expect(root().style.getPropertyValue('--fx-speed')).toBe('0.6');
  });

  it('does nothing harmful when storage is empty or corrupt', () => {
    localStorage.setItem(FX_KEY, '{not json');
    expect(() => new Function(FX_BOOT_SCRIPT)()).not.toThrow();
    expect(root().dataset.fxCore).toBeUndefined();
  });
});

describe('particleCount', () => {
  it('tiers are ordered', () => {
    expect(particleCount('low')).toBeLessThan(particleCount('medium'));
    expect(particleCount('medium')).toBeLessThan(particleCount('high'));
  });
});
