'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ── Pyodide singleton ──────────────────────────────────────────────────────
 * The runtime (~10 MB) is fetched from the CDN the FIRST time a user clicks
 * "Run" — never bundled, never preloaded. One instance is shared by every
 * code block on the page.
 */
interface PyodideAPI {
  loadPackagesFromImports: (code: string) => Promise<unknown>;
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (opts: { batched: (line: string) => void }) => void;
  setStderr: (opts: { batched: (line: string) => void }) => void;
}

let pyodidePromise: Promise<PyodideAPI> | null = null;

function getPyodide(): Promise<PyodideAPI> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      // @ts-expect-error — runtime CDN module; intentionally not resolvable by the bundler
      const mod = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.mjs');
      return mod.loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/' }) as Promise<PyodideAPI>;
    })();
    // If the CDN fetch fails (offline etc.), allow a later click to retry.
    pyodidePromise.catch(() => {
      pyodidePromise = null;
    });
  }
  return pyodidePromise;
}

/* Python snippet: grab the current matplotlib figure (if any) as base64 PNG. */
const MPL_CAPTURE = `
def _flux_grab_fig():
    try:
        import base64, io
        import matplotlib.pyplot as plt
        fig = plt.gcf()
        if not fig.get_axes():
            return ""
        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight")
        buf.seek(0)
        out = base64.b64encode(buf.read()).decode("ascii")
        plt.close(fig)
        return out
    except Exception:
        return ""
_flux_grab_fig()
`;

type Phase = 'idle' | 'loading-runtime' | 'loading-packages' | 'running';

interface Props {
  code: string;
  /** Increment to trigger a run (0 = never run). */
  runSignal: number;
  /** Lets the parent disable its Run button while a run is in flight. */
  onRunningChange?: (running: boolean) => void;
}

/**
 * Output panel rendered below a ```python code block. Executes the code in
 * Pyodide (CPython compiled to WASM, loaded lazily from the CDN), streaming
 * stdout/stderr into the panel and rendering matplotlib figures as images.
 */
export function PyRunner({ code, runSignal, onRunningChange }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [imgSrc, setImgSrc] = useState('');
  const [cleared, setCleared] = useState(false);

  const runningRef = useRef(false);
  const codeRef = useRef(code);
  codeRef.current = code;
  const lastSignal = useRef(0);

  const run = useCallback(async () => {
    if (runningRef.current) return; // guard concurrent runs
    runningRef.current = true;
    onRunningChange?.(true);
    setCleared(false);
    setOutput('');
    setError('');
    setImgSrc('');
    let buf = '';
    try {
      setPhase(pyodidePromise ? 'loading-packages' : 'loading-runtime');
      const pyodide = await getPyodide();
      const append = (line: string) => {
        buf += (buf ? '\n' : '') + line;
        setOutput(buf);
      };
      pyodide.setStdout({ batched: append });
      pyodide.setStderr({ batched: append });

      const src = codeRef.current;
      setPhase('loading-packages');
      await pyodide.loadPackagesFromImports(src); // auto-installs numpy/pandas/…

      setPhase('running');
      const usesMpl = src.includes('matplotlib');
      // AGG = headless backend; without it matplotlib tries to open a window.
      const finalCode = usesMpl ? `import matplotlib\nmatplotlib.use("AGG")\n${src}` : src;
      const result = await pyodide.runPythonAsync(finalCode);

      // Echo the final expression's value (like a REPL) when it isn't None.
      if (result !== undefined && result !== null) {
        const proxy = result as { toString: () => string; destroy?: () => void };
        append(String(proxy));
        proxy.destroy?.();
      }

      // Try to capture a matplotlib figure; harmless no-op for non-plot code.
      if (usesMpl) {
        try {
          const b64 = await pyodide.runPythonAsync(MPL_CAPTURE);
          if (typeof b64 === 'string' && b64.length > 0) {
            setImgSrc(`data:image/png;base64,${b64}`);
          }
        } catch {
          /* non-plot code is unaffected */
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPhase('idle');
      runningRef.current = false;
      onRunningChange?.(false);
    }
  }, [onRunningChange]);

  useEffect(() => {
    if (runSignal > 0 && runSignal !== lastSignal.current) {
      lastSignal.current = runSignal;
      void run();
    }
  }, [runSignal, run]);

  const busy = phase !== 'idle';
  if (cleared && !busy) return null;

  const statusText =
    phase === 'loading-runtime'
      ? 'Loading Python runtime… (~10 MB, first time only)'
      : phase === 'loading-packages'
        ? 'Loading packages…'
        : phase === 'running' && !output
          ? 'Running…'
          : '';

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--code,#0000)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--line)]">
        <span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-[var(--ink-4)]">
          {busy && (
            <svg className="w-3 h-3 animate-spin text-[var(--accent-fg)]" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-20" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          )}
          Output
        </span>
        <button
          onClick={() => setCleared(true)}
          disabled={busy}
          title="Clear output"
          className="text-[11px] font-medium rounded-md px-2 py-0.5 border border-[var(--line)] bg-[var(--fill)] hover:bg-[var(--fill-hover)] text-[var(--ink-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Clear
        </button>
      </div>
      <div className="p-3 text-xs font-mono whitespace-pre-wrap text-[var(--ink-2)] max-h-80 overflow-y-auto">
        {statusText && <div className="text-[var(--ink-4)]">{statusText}</div>}
        {output && <div>{output}</div>}
        {error && <div className="text-red-400 whitespace-pre-wrap">{error}</div>}
        {imgSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt="matplotlib output"
            className="mt-2 max-w-full h-auto rounded-md border border-[var(--line)] bg-white"
          />
        )}
        {!statusText && !output && !error && !imgSrc && (
          <div className="text-[var(--ink-4)]">(no output)</div>
        )}
      </div>
    </div>
  );
}
