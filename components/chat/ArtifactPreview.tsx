'use client';

import { useEffect } from 'react';

/**
 * Live HTML preview modal (Claude-artifacts style).
 *
 * Renders the fenced ```html block inside a sandboxed iframe. The sandbox
 * deliberately allows scripts but NOT same-origin access, so the previewed
 * code can never touch the app's cookies, storage, or DOM.
 */
export function ArtifactPreview({ code, onClose }: { code: string; onClose: () => void }) {
  // Esc to close.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const download = () => {
    const blob = new Blob([code], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'artifact.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const openInNewTab = () => {
    const blob = new Blob([code], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    // Give the new tab time to load before releasing the Blob URL.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in flex flex-col w-full h-full max-w-5xl rounded-2xl border border-[var(--line-strong)] bg-[var(--elevated)] shadow-2xl overflow-hidden"
      >
        {/* Header bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--line)] flex-shrink-0">
          <div className="w-7 h-7 flex-shrink-0 rounded bg-[var(--fill)] border border-[var(--line)] flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-[var(--accent-fg)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <span className="text-sm font-medium text-[var(--ink)] truncate flex-1 min-w-0">Preview</span>
          <button
            onClick={openInNewTab}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-3)] hover:text-[var(--ink)] px-2.5 py-1.5 rounded-lg hover:bg-[var(--fill)] border border-[var(--line)] transition-colors flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span className="hidden sm:inline">Open in new tab</span>
          </button>
          <button
            onClick={download}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-3)] hover:text-[var(--ink)] px-2.5 py-1.5 rounded-lg hover:bg-[var(--fill)] border border-[var(--line)] transition-colors flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
            Download
          </button>
          <button
            onClick={onClose}
            title="Close"
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sandboxed preview — allow-scripts only, never allow-same-origin */}
        <div className="flex-1 min-h-0">
          <iframe
            srcDoc={code}
            sandbox="allow-scripts"
            className="w-full h-full bg-white rounded-b-2xl"
            title="artifact"
          />
        </div>
      </div>
    </div>
  );
}
