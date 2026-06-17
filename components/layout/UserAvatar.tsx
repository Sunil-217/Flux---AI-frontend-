'use client';

import type { CSSProperties } from 'react';

// Superhero-themed avatar presets — a hero glyph on a themed gradient. The
// stored value is `preset:<index>`; index maps into this array. (Real licensed
// hero photos can't be bundled — users can Upload their own for that.)
export const AVATAR_PRESETS: { bg: string; emoji: string }[] = [
  { bg: 'linear-gradient(135deg,#fb7185,#b91c1c)', emoji: '🦸' },
  { bg: 'linear-gradient(135deg,#60a5fa,#1e40af)', emoji: '🦸‍♀️' },
  { bg: 'linear-gradient(135deg,#374151,#facc15)', emoji: '🦇' },
  { bg: 'linear-gradient(135deg,#ef4444,#1d4ed8)', emoji: '🕷️' },
  { bg: 'linear-gradient(135deg,#fde047,#f59e0b)', emoji: '⚡' },
  { bg: 'linear-gradient(135deg,#3b82f6,#b91c1c)', emoji: '🛡️' },
  { bg: 'linear-gradient(135deg,#ef4444,#f59e0b)', emoji: '🤖' },
  { bg: 'linear-gradient(135deg,#a78bfa,#6d28d9)', emoji: '🦹' },
];

function presetData(avatar?: string | null): { bg: string; emoji: string } | null {
  if (avatar && avatar.startsWith('preset:')) {
    const i = parseInt(avatar.slice('preset:'.length), 10);
    if (!Number.isNaN(i) && AVATAR_PRESETS[i]) return AVATAR_PRESETS[i];
  }
  return null;
}

/**
 * A user's avatar: an uploaded photo (data URL), a superhero preset (glyph on a
 * themed gradient), or — when neither is set — a monogram on the accent
 * gradient. One component so the settings page and the sidebar always match.
 */
export function UserAvatar({
  avatar,
  name,
  size = 40,
  className = '',
}: {
  avatar?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const box: CSSProperties = { width: size, height: size };

  // Uploaded photo.
  if (avatar && avatar.startsWith('data:')) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={avatar}
        alt={name ?? 'Profile photo'}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={box}
      />
    );
  }

  // Superhero preset.
  const preset = presetData(avatar);
  if (preset) {
    return (
      <div
        className={`rounded-full flex items-center justify-center flex-shrink-0 select-none ${className}`}
        style={{ ...box, background: preset.bg }}
        aria-hidden
      >
        <span style={{ fontSize: Math.round(size * 0.52), lineHeight: 1 }}>{preset.emoji}</span>
      </div>
    );
  }

  // Default monogram.
  const letter = name?.trim()?.[0]?.toUpperCase() ?? 'U';
  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${className}`}
      style={{ ...box, background: 'linear-gradient(135deg,var(--accent),var(--accent-strong))', fontSize: Math.round(size * 0.42) }}
      aria-hidden
    >
      {letter}
    </div>
  );
}
