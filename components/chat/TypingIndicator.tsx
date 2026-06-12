import { Logo } from '@/components/layout/Logo';

export function TypingIndicator() {
  return (
    <div role="status" aria-live="polite" className="animate-msg-in flex gap-3 items-center">
      {/* Orbiting satellite = the brand's "thinking" state. No bouncing dots —
          the motion is purposeful (orbit = working), not attention-seeking. */}
      <Logo size={28} round animated className="mt-0.5" />
      <span className="text-sm text-[var(--ink-3)]">Thinking…</span>
    </div>
  );
}
