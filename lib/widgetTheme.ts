// Shared appearance model for the embeddable chat widget.
// Used by both the embed page (app/embed/chat) and the Developer Console's
// Appearance editor so the live preview is pixel-identical to production.
import type { CSSProperties } from 'react';

export interface WidgetConfig {
  title: string; // header title / app name
  subtitle: string; // header status text (e.g. "Online")
  greeting: string; // empty-state heading
  tagline: string; // empty-state subheading
  accent: string; // hex color
  theme: string; // theme preset key
  suggestions: string[]; // suggested questions
  logoUrl: string; // header logo (https URL or data: URI); empty = default glyph
  customCss: string; // APPROVED CSS targeting .cai-* classes (review-gated)
}

export const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  title: 'Ask us anything',
  subtitle: 'Online',
  greeting: 'Hi there 👋',
  tagline: "Ask me anything — I'll answer from our docs.",
  accent: '#f87171',
  theme: 'midnight',
  suggestions: ['What do you offer?', 'How can I contact you?', 'What are your hours?'],
  logoUrl: '',
  customCss: '',
};

export interface WidgetTheme {
  key: string;
  label: string;
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  textMuted: string;
  inputBg: string;
  /** A small swatch used in the theme picker. */
  swatch: string;
}

export const WIDGET_THEMES: WidgetTheme[] = [
  { key: 'midnight', label: 'Midnight', bg: '#0a0a0b', surface: 'rgba(255,255,255,0.07)', surface2: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.10)', text: '#fafafa', textMuted: '#9ca3af', inputBg: 'rgba(255,255,255,0.05)', swatch: '#0a0a0b' },
  { key: 'slate', label: 'Slate', bg: '#0f172a', surface: 'rgba(255,255,255,0.06)', surface2: '#1e293b', border: 'rgba(148,163,184,0.22)', text: '#f1f5f9', textMuted: '#94a3b8', inputBg: 'rgba(255,255,255,0.05)', swatch: '#0f172a' },
  { key: 'ocean', label: 'Ocean', bg: '#082f49', surface: 'rgba(255,255,255,0.07)', surface2: 'rgba(2,32,54,0.55)', border: 'rgba(56,189,248,0.22)', text: '#e0f2fe', textMuted: '#7dd3fc', inputBg: 'rgba(255,255,255,0.06)', swatch: '#082f49' },
  { key: 'light', label: 'Light', bg: '#ffffff', surface: '#f4f4f5', surface2: '#f4f4f5', border: '#e4e4e7', text: '#18181b', textMuted: '#71717a', inputBg: '#f4f4f5', swatch: '#ffffff' },
  { key: 'sand', label: 'Sand', bg: '#fdf6ec', surface: '#f4e8d4', surface2: '#f4e8d4', border: '#e7d8bd', text: '#3f3422', textMuted: '#8a7a5c', inputBg: '#f4e8d4', swatch: '#fdf6ec' },
];

export function getWidgetTheme(key: string): WidgetTheme {
  return WIDGET_THEMES.find((t) => t.key === key) ?? WIDGET_THEMES[0];
}

export function mergeWidgetConfig(partial: Partial<WidgetConfig> | null | undefined): WidgetConfig {
  return { ...DEFAULT_WIDGET_CONFIG, ...(partial ?? {}) };
}

/** CSS variables consumed by the widget UI (embed page + preview). */
export function widgetThemeVars(cfg: WidgetConfig): CSSProperties {
  const t = getWidgetTheme(cfg.theme);
  const vars: Record<string, string> = {
    '--w-accent': cfg.accent || DEFAULT_WIDGET_CONFIG.accent,
    '--w-bg': t.bg,
    '--w-surface': t.surface,
    '--w-surface-2': t.surface2,
    '--w-border': t.border,
    '--w-text': t.text,
    '--w-text-muted': t.textMuted,
    '--w-input-bg': t.inputBg,
  };
  return vars as CSSProperties;
}

/** Root background: a soft accent glow over the theme base color. */
export function widgetBackground(cfg: WidgetConfig): string {
  const t = getWidgetTheme(cfg.theme);
  return `radial-gradient(120% 80% at 50% -10%, color-mix(in srgb, ${cfg.accent || '#f87171'} 14%, transparent), transparent 60%), ${t.bg}`;
}

/** Documented styling hooks surfaced in the Appearance editor. */
export const WIDGET_CSS_CLASSES: { cls: string; desc: string }[] = [
  { cls: '.cai-widget', desc: 'the whole widget' },
  { cls: '.cai-header', desc: 'top header bar' },
  { cls: '.cai-logo', desc: 'header logo / icon' },
  { cls: '.cai-title', desc: 'header title / app name' },
  { cls: '.cai-greeting', desc: 'welcome heading' },
  { cls: '.cai-suggestion', desc: 'suggested-question chips' },
  { cls: '.cai-msg-user', desc: 'visitor message bubble' },
  { cls: '.cai-msg-bot', desc: 'assistant message bubble' },
  { cls: '.cai-input', desc: 'message input box' },
  { cls: '.cai-send', desc: 'send button' },
  { cls: '.cai-footer', desc: 'footer / branding' },
];
