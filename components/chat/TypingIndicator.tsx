import { AICore } from '@/components/fx/AICore';
import { coreStateFor } from '@/lib/fx/coreState';

/**
 * What the system is doing, right now.
 *
 * `label` is the current stage on the autonomous agent path — one of a closed
 * set the backend chose because it is safe to show ("Researching",
 * "Verifying"). It is never the model's reasoning, and this component never
 * derives anything the backend did not send: ordinary chat passes nothing and
 * the indicator reads exactly as it always has.
 *
 * The core beside it is the same object as the one on the sign-in screen, in a
 * state mapped from that same label — so the interface has one intelligence,
 * visibly doing the thing the text says it is doing.
 */
export function TypingIndicator({ label }: { label?: string }) {
  const state = coreStateFor(label ?? '', true);

  return (
    <div role="status" aria-live="polite" className="animate-msg-in flex items-center gap-3">
      {/* Small enough to be a status light rather than a centrepiece. */}
      <AICore state={state} size={30} />

      <span className="text-sm text-[var(--ink-3)]">{label ? `${label}…` : 'Thinking…'}</span>

      {/* A hairline that says work is in progress without claiming to know how
          far along it is. Nothing reports a percentage, so nothing shows one. */}
      <span className="fx-stream w-16" data-indeterminate="true" aria-hidden>
        <i />
      </span>
    </div>
  );
}
