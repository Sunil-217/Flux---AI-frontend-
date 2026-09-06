'use client';

import type { ScanState } from '@/hooks/useFileUpload';

/**
 * What is happening to a document, while it happens.
 *
 * Three steps, not five. The server does chunk, embed and store — but it
 * reports once, at the end, so animating through "scanning → embedding →
 * vectorising" would be narrating work this client cannot observe. `Detected`
 * (we hold the file), `Indexing` (the request is in flight) and `Ready` (the
 * server answered) are the states that are true, and the outcome line quotes
 * the server rather than paraphrasing it.
 *
 * `reused` is worth showing plainly: it means the identical file was already
 * indexed and no embedding quota was spent at all.
 */

const STEPS = ['Detected', 'Indexing', 'Ready'] as const;

const OUTCOME_COPY: Record<string, string> = {
  indexed: 'Semantic index built',
  replaced: 'Semantic index rebuilt — previous version replaced',
  reused: 'Already indexed — reused, nothing re-embedded',
};

function stepIndex(phase: ScanState['phase']): number {
  if (phase === 'detected') return 0;
  if (phase === 'indexing') return 1;
  if (phase === 'ready') return 2;
  return -1;
}

export function DocumentScanner({ scan }: { scan: ScanState }) {
  if (scan.phase === 'idle') return null;

  const failed = scan.phase === 'failed';
  const active = stepIndex(scan.phase);
  const busy = scan.phase === 'detected' || scan.phase === 'indexing';

  return (
    <div
      className={`fx-holo fx-scanner ${busy ? 'fx-scan fx-energy' : ''}`}
      role="status"
      aria-live="polite"
      data-failed={failed ? 'true' : 'false'}
    >
      <div className="fx-scanner__head">
        <span className="fx-label">
          {failed ? 'Indexing failed' : scan.phase === 'ready' ? 'Source ready' : 'Source detected'}
        </span>
        {scan.queued > 0 && (
          <span className="fx-label fx-scanner__queue">+{scan.queued} queued</span>
        )}
      </div>

      <p className="fx-scanner__name" title={scan.filename}>
        {scan.filename}
      </p>

      {failed ? (
        // The server's own reason, not a generic apology.
        <p className="fx-scanner__error">{scan.error}</p>
      ) : (
        <>
          <ol className="fx-scanner__steps">
            {STEPS.map((label, i) => (
              <li key={label} data-state={i < active ? 'done' : i === active ? 'active' : 'idle'}>
                <span className="fx-scanner__pip" aria-hidden />
                {label}
              </li>
            ))}
          </ol>

          {/* Indeterminate while in flight: the server sends no progress, so
              showing a percentage would mean inventing one. */}
          {busy && (
            <span className="fx-stream fx-scanner__stream" data-indeterminate="true" aria-hidden>
              <i />
            </span>
          )}

          {scan.phase === 'ready' && (
            <p className="fx-scanner__outcome">
              {scan.outcome ? OUTCOME_COPY[scan.outcome] ?? 'Indexed' : 'Indexed'}
              {typeof scan.chunks === 'number' && (
                <>
                  {' · '}
                  {scan.chunks} passage{scan.chunks === 1 ? '' : 's'}
                </>
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}
