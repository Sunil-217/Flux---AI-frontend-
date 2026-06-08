'use client';

import { createPortal } from 'react-dom';

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['Ctrl', 'K'], label: 'Open command palette' },
  { keys: ['Enter'], label: 'Send message' },
  { keys: ['Shift', 'Enter'], label: 'New line in message' },
  { keys: ['/'], label: 'Slash commands (at start of message)' },
  { keys: ['Esc'], label: 'Stop generating / close dialogs' },
  { keys: ['?'], label: 'Show this shortcuts list' },
  { keys: ['Double-click'], label: 'Rename a chat in the sidebar' },
];

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-[var(--elevated)] border border-[var(--line-strong)] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
          <h2 className="text-base font-semibold text-[var(--ink)]">Keyboard shortcuts</h2>
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
        <div className="p-5 space-y-3">
          {SHORTCUTS.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-4">
              <span className="text-sm text-[var(--ink-2)]">{s.label}</span>
              <span className="flex items-center gap-1 flex-shrink-0">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="px-2 py-0.5 rounded-md bg-[var(--fill)] border border-[var(--line)] text-[11px] font-medium text-[var(--ink-2)] shadow-sm"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
