'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export function AddUrlModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (url: string) => Promise<boolean>;
}) {
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  const submit = async () => {
    const v = url.trim();
    if (!v || submitting) return;
    setSubmitting(true);
    const ok = await onSubmit(v);
    setSubmitting(false);
    if (ok) onClose();
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !submitting && onClose()}
      />
      <div className="relative w-full max-w-md rounded-2xl bg-[var(--elevated)] border border-[var(--line-strong)] shadow-2xl overflow-hidden">
        <div className="p-5">
          <div className="flex items-start gap-3 mb-1">
            <span className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-[var(--fill)] text-[var(--accent-fg)]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5m6.828-1.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5" />
              </svg>
            </span>
            <div>
              <h2 className="text-base font-semibold text-[var(--ink)]">Chat with a web page</h2>
              <p className="text-xs text-[var(--ink-3)]">Paste a URL — its content gets indexed for Q&amp;A.</p>
            </div>
          </div>

          <input
            ref={inputRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            disabled={submitting}
            placeholder="https://example.com/article"
            className="w-full mt-4 bg-[var(--fill)] border border-[var(--line)] rounded-lg px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-60"
          />

          <div className="flex items-center justify-end gap-2 mt-5">
            <button
              onClick={onClose}
              disabled={submitting}
              className="text-sm font-medium text-[var(--ink-3)] hover:text-[var(--ink)] px-4 py-2 rounded-lg hover:bg-[var(--fill)] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting || !url.trim()}
              className="text-sm font-medium rounded-lg bg-[var(--accent)] text-white px-5 py-2 hover:bg-[var(--accent-strong)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
            >
              {submitting && (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              )}
              {submitting ? 'Reading…' : 'Add page'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
