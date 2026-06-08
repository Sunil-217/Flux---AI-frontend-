'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';

export interface SavedPrompt {
  id: string;
  title: string;
  text: string;
}

const PROMPTS_KEY = 'close_ai_prompts';

function load(): SavedPrompt[] {
  try {
    const raw = localStorage.getItem(PROMPTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function persist(p: SavedPrompt[]) {
  try {
    localStorage.setItem(PROMPTS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return String(Date.now()) + Math.round(Math.random() * 1e6);
  }
}

export function PromptLibraryModal({
  onClose,
  onUse,
}: {
  onClose: () => void;
  onUse: (text: string) => void;
}) {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => setPrompts(load()), []);

  const reset = () => {
    setTitle('');
    setText('');
    setEditingId(null);
  };
  const save = () => {
    if (!text.trim()) {
      toast.error('Enter the prompt text.');
      return;
    }
    const t = title.trim() || text.trim().slice(0, 40);
    const next = editingId
      ? prompts.map((p) => (p.id === editingId ? { ...p, title: t, text: text.trim() } : p))
      : [{ id: newId(), title: t, text: text.trim() }, ...prompts];
    setPrompts(next);
    persist(next);
    reset();
    toast.success(editingId ? 'Prompt updated' : 'Prompt saved');
  };
  const remove = (id: string) => {
    const next = prompts.filter((p) => p.id !== id);
    setPrompts(next);
    persist(next);
    if (editingId === id) reset();
  };
  const edit = (p: SavedPrompt) => {
    setEditingId(p.id);
    setTitle(p.title);
    setText(p.text);
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl bg-[var(--elevated)] border border-[var(--line-strong)] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[var(--line)]">
          <h2 className="text-base font-semibold text-[var(--ink)]">Prompt library</h2>
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

        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {prompts.length === 0 ? (
            <p className="text-sm text-[var(--ink-3)] text-center py-6">
              No saved prompts yet. Add one below to reuse it anytime.
            </p>
          ) : (
            prompts.map((p) => (
              <div
                key={p.id}
                className="group flex items-start gap-2 rounded-xl border border-[var(--line)] hover:border-[var(--line-strong)] p-3 transition-colors"
              >
                <button onClick={() => onUse(p.text)} className="flex-1 min-w-0 text-left" title="Use this prompt">
                  <p className="text-sm font-medium text-[var(--ink)] truncate">{p.title}</p>
                  <p className="text-xs text-[var(--ink-3)] mt-0.5 line-clamp-2">{p.text}</p>
                </button>
                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => edit(p)} title="Edit" className="p-1.5 rounded-lg text-[var(--ink-4)] hover:text-[var(--ink)] hover:bg-[var(--fill)]">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => remove(p.id)} title="Delete" className="p-1.5 rounded-lg text-[var(--ink-4)] hover:text-red-400 hover:bg-red-400/10">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-[var(--line)] p-5 space-y-2">
          <p className="text-xs font-medium text-[var(--ink-3)] mb-2">
            {editingId ? 'Edit prompt' : 'New prompt'}
          </p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full bg-[var(--fill)] border border-[var(--line)] rounded-lg px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)] transition-colors"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Prompt text…"
            rows={2}
            className="w-full bg-[var(--fill)] border border-[var(--line)] rounded-lg px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)] transition-colors resize-none"
          />
          <div className="flex items-center justify-end gap-2">
            {editingId && (
              <button onClick={reset} className="text-sm text-[var(--ink-3)] hover:text-[var(--ink)] px-3 py-1.5">
                Cancel
              </button>
            )}
            <button
              onClick={save}
              className="text-sm font-medium rounded-lg bg-[var(--accent)] text-white px-4 py-1.5 hover:bg-[var(--accent-strong)] transition-colors"
            >
              {editingId ? 'Update' : 'Save prompt'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
