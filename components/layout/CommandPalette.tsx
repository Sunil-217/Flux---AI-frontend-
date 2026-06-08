'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ChatSession } from '@/types';

export interface PaletteAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  run: () => void;
}

export function CommandPalette({
  onClose,
  sessions,
  onSelectSession,
  actions,
}: {
  onClose: () => void;
  sessions: ChatSession[];
  onSelectSession: (id: string) => void;
  actions: PaletteAction[];
}) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const ql = q.trim().toLowerCase();
  const matchedActions = actions.filter((a) => a.label.toLowerCase().includes(ql));
  const matchedChats = sessions
    .filter((s) => (s.messages?.length ?? 0) > 0 && s.title.toLowerCase().includes(ql))
    .slice(0, 6);

  type Item = { kind: 'action'; a: PaletteAction } | { kind: 'chat'; s: ChatSession };
  const items: Item[] = [
    ...matchedActions.map((a) => ({ kind: 'action' as const, a })),
    ...matchedChats.map((s) => ({ kind: 'chat' as const, s })),
  ];

  useEffect(() => {
    setIdx(0);
  }, [q]);

  const run = (i: number) => {
    const it = items[i];
    if (!it) return;
    if (it.kind === 'action') it.a.run();
    else onSelectSession(it.s.id);
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIdx((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(idx);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-start justify-center pt-[14vh] px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-[var(--elevated)] border border-[var(--line-strong)] shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 border-b border-[var(--line)]">
          <svg className="w-4 h-4 flex-shrink-0 text-[var(--ink-4)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search chats or run a command…"
            className="flex-1 bg-transparent py-3.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none"
          />
          <kbd className="text-[10px] text-[var(--ink-4)] border border-[var(--line)] rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <div className="max-h-[320px] overflow-y-auto py-1.5">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[var(--ink-4)] text-center">No results</p>
          ) : (
            items.map((it, i) => {
              const active = i === idx;
              const label = it.kind === 'action' ? it.a.label : it.s.title;
              const icon =
                it.kind === 'action' ? (
                  it.a.icon
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-9 6l1.5-3A8 8 0 1119 9a8 8 0 01-11.5 7L4 20z" /></svg>
                );
              const key = it.kind === 'action' ? `a:${it.a.id}` : `c:${it.s.id}`;
              return (
                <button
                  key={key}
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => run(i)}
                  className={`flex items-center gap-3 w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    active ? 'bg-[var(--fill)] text-[var(--ink)]' : 'text-[var(--ink-2)]'
                  }`}
                >
                  <span className="flex-shrink-0 text-[var(--ink-4)]">{icon}</span>
                  <span className="truncate">{label}</span>
                  {it.kind === 'action' && (
                    <span className="ml-auto text-[10px] uppercase tracking-wide text-[var(--ink-4)]">Action</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
