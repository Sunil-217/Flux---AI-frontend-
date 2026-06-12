'use client';

/**
 * The Context Rail — a live readout of the AI's working state, not a menu.
 *
 * Every line is DERIVED from real data: the session's messages (exchanges,
 * citations, last report), its attached sources (typed counts), the user's
 * memory (newest facts first, refreshed as the conversation produces new
 * ones), and the active persona (identity + behavior profile). Actions exist
 * only as small inline verbs inside the state they belong to.
 */

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { getMemoryFacts, deleteMemoryFact } from '@/services/api';
import type { ChatSession } from '@/types';

interface Persona {
  id: string;
  name: string;
  emoji: string;
  prompt: string;
}

// Same keys Settings → Personas writes; the chat layer reads the third.
const PERSONAS_KEY = 'close_ai_personas';
const ACTIVE_PERSONA_KEY = 'close_ai_active_persona';
const PERSONA_PROMPT_KEY = 'close_ai_persona_prompt';
const RAIL_KEY = 'close_ai_rail_open';

function sourceKind(name: string): 'video' | 'repo' | 'page' | 'doc' {
  const n = name.toLowerCase();
  if (n.includes('youtube') || n.includes('youtu.be')) return 'video';
  if (n.includes('github')) return 'repo';
  if (n.startsWith('http')) return 'page';
  return 'doc';
}

const KIND_LABEL: Record<string, [string, string]> = {
  doc: ['document', 'documents'],
  page: ['web page', 'web pages'],
  repo: ['repository', 'repositories'],
  video: ['video source', 'video sources'],
};

function relTime(ts?: number): string {
  if (!ts) return '';
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d}d ago`;
}

const heading =
  'flex items-baseline gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-4)]';
const statLine = 'text-[11px] leading-relaxed text-[var(--ink-3)]';
const verb = 'text-[10px] font-medium text-[var(--accent-fg)] hover:opacity-75 transition-opacity';

export function ContextRail({
  session,
  onAddUrl,
  onResearch,
  onQuiz,
}: {
  session: ChatSession | null;
  onAddUrl: () => void;
  onResearch: () => void;
  onQuiz: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [activeId, setActiveId] = useState('');
  const [facts, setFacts] = useState<string[]>([]);
  const [pMenu, setPMenu] = useState(false); // persona dropdown open

  const msgCount = session?.messages?.length ?? 0;

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(RAIL_KEY) !== 'closed');
      const raw = localStorage.getItem(PERSONAS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      setPersonas(Array.isArray(arr) ? arr : []);
      setActiveId(localStorage.getItem(ACTIVE_PERSONA_KEY) || '');
    } catch {
      /* ignore */
    }
  }, []);

  // Memory grows as the conversation produces extractable facts — refresh when
  // the message count settles on a new value, so the rail stays live.
  useEffect(() => {
    const t = setTimeout(() => {
      getMemoryFacts()
        .then(setFacts)
        .catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [msgCount]);

  // ── Live session intelligence, derived from the actual messages ──
  const stats = useMemo(() => {
    const msgs = session?.messages ?? [];
    let exchanges = 0;
    let citations = 0;
    let reports = 0;
    let quizzes = 0;
    let generated = 0;
    let lastCited: number | undefined;
    for (const m of msgs) {
      if (m.role === 'user') exchanges += 1;
      if (m.role !== 'assistant') continue;
      const n = m.sources?.length ?? 0;
      if (n > 0) {
        citations += n;
        reports += 1;
        lastCited = m.timestamp;
      }
      if (m.quizData?.length) quizzes += 1;
      if (m.imageUrl || m.pdfUrl || m.fileUrl || m.videoUrl) generated += 1;
    }
    return { exchanges, citations, reports, quizzes, generated, lastCited };
  }, [session?.messages]);

  const sources = useMemo(() => {
    const list = session?.uploadedFiles ?? [];
    const byKind: Record<string, number> = {};
    for (const s of list) byKind[sourceKind(s)] = (byKind[sourceKind(s)] ?? 0) + 1;
    const summary = (['doc', 'page', 'repo', 'video'] as const)
      .filter((k) => byKind[k])
      .map((k) => `${byKind[k]} ${KIND_LABEL[k][byKind[k] === 1 ? 0 : 1]}`)
      .join(' · ');
    return { list, summary };
  }, [session?.uploadedFiles]);

  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(RAIL_KEY, o ? 'closed' : 'open');
      } catch {
        /* ignore */
      }
      return !o;
    });
  };

  // Mirrors the Settings → Personas contract exactly.
  const switchPersona = (id: string) => {
    setActiveId(id);
    const p = personas.find((x) => x.id === id) || null;
    try {
      localStorage.setItem(ACTIVE_PERSONA_KEY, p ? p.id : '');
      if (p) localStorage.setItem(PERSONA_PROMPT_KEY, p.prompt);
      else localStorage.removeItem(PERSONA_PROMPT_KEY);
    } catch {
      /* ignore */
    }
  };

  const forget = (i: number) => {
    // Facts render newest-first; the API expects the stored (oldest-first) index.
    deleteMemoryFact(facts.length - 1 - i)
      .then(setFacts)
      .catch(() => toast.error('Could not remove that.'));
  };

  const active = personas.find((p) => p.id === activeId) || null;
  const newestFirst = useMemo(() => [...facts].reverse(), [facts]);

  if (!open) {
    return (
      <div className="hidden xl:flex flex-col items-center flex-shrink-0 w-10 border-l border-[var(--line)] bg-[var(--panel)] pt-3">
        <button
          onClick={toggle}
          title="Open context panel"
          aria-label="Open context panel"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
      </div>
    );
  }

  return (
    <aside className="hidden xl:flex flex-col flex-shrink-0 w-72 border-l border-[var(--line)] bg-[var(--panel)] overflow-y-auto">
      {/* Presence header — this panel is the AI's working state */}
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <h2 className="flex items-center gap-2 text-xs font-semibold text-[var(--ink-2)]">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inline-flex w-full h-full rounded-full bg-[var(--accent)] opacity-60 animate-ping [animation-duration:2.6s]" />
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
          </span>
          Context
        </h2>
        <button
          onClick={toggle}
          title="Collapse panel"
          aria-label="Collapse context panel"
          className="w-6 h-6 flex items-center justify-center rounded text-[var(--ink-4)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      <div className="px-4 pb-5 divide-y divide-[var(--line)]">
        {/* ── Session ── */}
        <section className="py-3.5">
          <p className={heading}>Session</p>
          <p className={`${statLine} mt-1.5`}>
            {stats.exchanges === 0 ? (
              'New session — nothing exchanged yet.'
            ) : (
              <>
                {stats.exchanges} exchange{stats.exchanges === 1 ? '' : 's'}
                {stats.generated > 0 && <> · {stats.generated} file{stats.generated === 1 ? '' : 's'} generated</>}
                {stats.quizzes > 0 && <> · {stats.quizzes} quiz{stats.quizzes === 1 ? '' : 'zes'}</>}
              </>
            )}
          </p>
          <div className="mt-1 flex items-center justify-between">
            <p className={statLine}>
              {stats.reports > 0 ? (
                <>
                  {stats.reports} cited repl{stats.reports === 1 ? 'y' : 'ies'} · {stats.citations}{' '}
                  citation{stats.citations === 1 ? '' : 's'}
                  {stats.lastCited && (
                    <span className="text-[var(--ink-4)]"> · {relTime(stats.lastCited)}</span>
                  )}
                </>
              ) : (
                <span className="text-[var(--ink-4)]">No cited research yet</span>
              )}
            </p>
            <span className="flex gap-2.5 flex-shrink-0 pl-2">
              <button onClick={onResearch} className={verb}>Research</button>
              <button onClick={onQuiz} className={verb}>Quiz</button>
            </span>
          </div>
        </section>

        {/* ── Knowledge ── */}
        <section className="py-3.5">
          <div className="flex items-baseline justify-between">
            <p className={heading}>
              Knowledge
              {sources.list.length > 0 && <span className="text-[var(--ink-3)]">{sources.list.length}</span>}
            </p>
            <button onClick={onAddUrl} className={verb}>+ Add</button>
          </div>
          {sources.list.length === 0 ? (
            <p className={`${statLine} mt-1.5 text-[var(--ink-4)]`}>
              Working from general knowledge only — no sources attached.
            </p>
          ) : (
            <>
              <p className={`${statLine} mt-1.5 text-[var(--ink-2)]`}>{sources.summary}</p>
              <ul className="mt-1.5 space-y-0.5">
                {sources.list.slice(0, 4).map((s) => (
                  <li key={s} className="text-[11px] text-[var(--ink-4)] truncate" title={s}>
                    — {s}
                  </li>
                ))}
                {sources.list.length > 4 && (
                  <li className="text-[10px] text-[var(--ink-4)]">+{sources.list.length - 4} more</li>
                )}
              </ul>
            </>
          )}
        </section>

        {/* ── Memory ── */}
        <section className="py-3.5">
          <p className={heading}>
            Memory
            {facts.length > 0 && <span className="text-[var(--ink-3)]">{facts.length}</span>}
          </p>
          {facts.length === 0 ? (
            <p className={`${statLine} mt-1.5 text-[var(--ink-4)]`}>
              No durable memories yet — learned facts appear here as you work.
            </p>
          ) : (
            <>
              <p className={`${statLine} mt-1.5 text-[var(--ink-2)]`}>
                {facts.length} active memor{facts.length === 1 ? 'y' : 'ies'} · applied to every reply
              </p>
              <ul className="mt-1.5 space-y-1">
                {newestFirst.slice(0, 4).map((f, i) => (
                  <li key={`${i}-${f.slice(0, 18)}`} className="group flex items-start gap-1.5">
                    <span className="flex-1 text-[11px] leading-snug text-[var(--ink-3)]">{f}</span>
                    <button
                      onClick={() => forget(i)}
                      title="Forget this"
                      aria-label={`Forget: ${f}`}
                      className="opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5 text-[var(--ink-4)] hover:text-red-400 transition-opacity"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </li>
                ))}
                {facts.length > 4 && (
                  <li className="text-[10px] text-[var(--ink-4)]">+{facts.length - 4} older · Settings → Memory</li>
                )}
              </ul>
            </>
          )}
        </section>

        {/* ── Persona ── (custom dropdown — native <select> option lists can't
             be dark-themed and render as an OS-default white box) */}
        <section className="py-3.5">
          <p className={heading}>Persona</p>
          <div className="relative mt-1.5">
            <button
              onClick={() => setPMenu((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={pMenu}
              className="flex items-center gap-1.5 w-full rounded-lg border border-[var(--line)] bg-[var(--fill)] hover:bg-[var(--fill-hover)] px-2.5 py-1.5 text-left transition-colors"
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? 'bg-[var(--accent)]' : 'bg-[var(--ink-4)]'}`} />
              <span className="flex-1 min-w-0 truncate text-xs font-medium text-[var(--ink)]">
                {active ? active.name : 'Default assistant'}
              </span>
              <svg className={`w-3 h-3 flex-shrink-0 text-[var(--ink-4)] transition-transform ${pMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {pMenu && (
              <>
                <button
                  className="fixed inset-0 z-40 cursor-default"
                  aria-hidden="true"
                  tabIndex={-1}
                  onClick={() => setPMenu(false)}
                />
                <ul
                  role="listbox"
                  className="absolute left-0 right-0 bottom-full mb-1 z-50 max-h-56 overflow-y-auto rounded-lg border border-[var(--line-strong)] bg-[var(--elevated)] shadow-xl py-1"
                >
                  {[{ id: '', name: 'Default assistant' }, ...personas].map((p) => {
                    const sel = p.id === activeId;
                    return (
                      <li key={p.id || 'default'} role="option" aria-selected={sel}>
                        <button
                          onClick={() => {
                            switchPersona(p.id);
                            setPMenu(false);
                          }}
                          className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-xs transition-colors ${
                            sel ? 'text-[var(--ink)] bg-[var(--fill)]' : 'text-[var(--ink-2)] hover:bg-[var(--fill)]'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.id ? 'bg-[var(--accent)]' : 'bg-[var(--ink-4)]'} ${sel ? '' : 'opacity-40'}`} />
                          <span className="flex-1 truncate">{p.name}</span>
                          {sel && (
                            <svg className="w-3 h-3 flex-shrink-0 text-[var(--accent-fg)]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
          <p className={`${statLine} mt-1.5 text-[var(--ink-4)] line-clamp-2`}>
            {active
              ? active.prompt
              : 'Neutral behavior — answers calibrated to each question.'}
          </p>
        </section>
      </div>
    </aside>
  );
}
