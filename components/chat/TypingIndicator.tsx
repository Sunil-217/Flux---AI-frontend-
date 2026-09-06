import { Logo } from '@/components/layout/Logo';

/**
 * `label` names the current stage on the autonomous agent path ("Researching",
 * "Verifying"). It is one of a fixed set of safe, high-level words from the
 * backend — never the model's reasoning. Ordinary chat passes nothing and the
 * indicator reads exactly as it always has.
 */
export function TypingIndicator({ label }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="animate-msg-in flex gap-3 items-center">
      {/* Orbiting satellite = the brand's "thinking" state. No bouncing dots —
          the motion is purposeful (orbit = working), not attention-seeking. */}
      <Logo size={28} round animated className="mt-0.5" />
      <span className="text-sm text-[var(--ink-3)]">{label ? `${label}…` : 'Thinking…'}</span>
    </div>
  );
}
