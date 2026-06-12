'use client';

import { useEffect, useState, type ReactNode } from 'react';

/* ── Mermaid singleton ──────────────────────────────────────────────────────
 * Loaded from the CDN the first time a ```mermaid block scrolls into the
 * conversation — never bundled. Initialized exactly once, theme matched to
 * the app's light/dark class on <html>.
 */
interface MermaidAPI {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, code: string) => Promise<{ svg: string }>;
}

let mermaidPromise: Promise<MermaidAPI> | null = null;

function getMermaid(): Promise<MermaidAPI> {
  if (!mermaidPromise) {
    mermaidPromise = (async () => {
      // @ts-expect-error — runtime CDN module; intentionally not resolvable by the bundler
      const mod = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs');
      const mermaid = (mod.default ?? mod) as MermaidAPI;
      mermaid.initialize({
        startOnLoad: false,
        theme: document.documentElement.classList.contains('light') ? 'default' : 'dark',
        securityLevel: 'strict',
      });
      return mermaid;
    })();
    // If the CDN fetch fails (offline etc.), allow a later mount to retry.
    mermaidPromise.catch(() => {
      mermaidPromise = null;
    });
  }
  return mermaidPromise;
}

let renderSeq = 0;

interface Props {
  code: string;
  /** Shown (with a small note) when the diagram fails to parse/render. */
  fallback?: ReactNode;
}

/**
 * Replaces a ```mermaid code block with the rendered SVG diagram.
 * While the model is still streaming the block, intermediate (incomplete)
 * definitions fail to parse — the last good SVG is kept on screen, and the
 * raw code block is only shown if nothing ever rendered.
 */
export function MermaidBlock({ code, fallback }: Props) {
  const [svg, setSvg] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!code.trim()) return;

    // Debounce: during streaming the code changes on every chunk; re-rendering
    // each time is wasteful and flickery.
    const timer = setTimeout(async () => {
      const id = `flux-mmd-${++renderSeq}`;
      try {
        const mermaid = await getMermaid();
        const { svg: rendered } = await mermaid.render(id, code);
        if (!cancelled) {
          setSvg(rendered);
          setFailed(false);
        }
      } catch {
        // mermaid.render can leave an orphaned error element in <body>.
        document.getElementById(id)?.remove();
        if (!cancelled) setFailed(true);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code]);

  // Parse error and nothing ever rendered → show the original code block.
  if (failed && !svg) {
    return (
      <div className="my-4">
        {fallback}
        <p className="-mt-2 text-[11px] text-[var(--ink-4)]">diagram failed to render</p>
      </div>
    );
  }

  // Loading shimmer while the library downloads / first render runs.
  if (!svg) {
    return (
      <div className="my-4 relative h-28 rounded-xl border border-[var(--line)] bg-[var(--panel)] overflow-hidden">
        <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_30%,var(--fill-hover)_50%,transparent_70%)] bg-[length:200%_100%]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs text-[var(--ink-4)]">Rendering diagram…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="my-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 overflow-x-auto">
      {/* securityLevel: 'strict' sanitizes the SVG — safe to inject. */}
      <div
        className="flex justify-center [&_svg]:max-w-full [&_svg]:h-auto"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
