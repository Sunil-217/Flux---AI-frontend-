'use client';

import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';

export function SummaryModal({
  summary,
  loading,
  onClose,
}: {
  summary: string;
  loading: boolean;
  onClose: () => void;
}) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl bg-[var(--elevated)] border border-[var(--line-strong)] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
          <h2 className="text-base font-semibold text-[var(--ink)]">Conversation summary</h2>
          <div className="flex items-center gap-2">
            {!loading && summary && (
              <button
                onClick={() => {
                  navigator.clipboard
                    .writeText(summary)
                    .then(() => toast.success('Summary copied'))
                    .catch(() => toast.error('Could not copy — clipboard blocked.'));
                }}
                title="Copy summary"
                aria-label="Copy summary"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="p-5 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--ink-3)]">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-[var(--line-strong)] border-t-[var(--accent)] animate-spin" />
              Summarising…
            </div>
          ) : summary ? (
            <div className="text-sm text-[var(--ink-2)] leading-7 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:leading-7 [&_strong]:text-[var(--ink)] [&_strong]:font-semibold [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-[var(--ink)] [&_h2]:font-semibold [&_h2]:text-[var(--ink)] [&_h2]:mt-3 [&_p]:mb-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-[var(--ink-3)]">Couldn&apos;t generate a summary — please try again.</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
