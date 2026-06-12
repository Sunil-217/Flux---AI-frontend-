'use client';

/**
 * The Library — Close AI's accumulated-intelligence surface.
 *
 * Three views over REAL workspace data, computed from the user's sessions:
 *  · Research  — every cited reply ever produced, across all sessions, newest
 *                first, with citation counts and one-click resume.
 *  · Knowledge — every source ever attached, deduplicated, typed, with the
 *                sessions that depend on it (the knowledge graph, as a list).
 *  · Memory    — the full ledger of what the AI remembers, with per-fact
 *                forget. No fabricated metadata: facts are shown in learned
 *                order (the backend doesn't store per-fact timestamps).
 *
 * This is the surface that makes leaving costly: thirty days of reports,
 * sources, and memories live here, one click from any of them.
 */

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { getMemoryFacts, deleteMemoryFact, clearMemory } from '@/services/api';
import { ConfirmModal } from '@/components/layout/Dialogs';
import { Logo } from '@/components/layout/Logo';
import type { ChatSession, Folder } from '@/types';

type Tab = 'research' | 'knowledge' | 'memory';

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

function sourceKind(name: string): 'video' | 'repo' | 'page' | 'doc' {
  const n = name.toLowerCase();
  if (n.includes('youtube') || n.includes('youtu.be')) return 'video';
  if (n.includes('github')) return 'repo';
  if (n.startsWith('http')) return 'page';
  return 'doc';
}

const KIND_NAME: Record<string, string> = {
  doc: 'Document',
  page: 'Web page',
  repo: 'Repository',
  video: 'Video',
};

/** First ~150 chars of a report, stripped of markdown furniture. */
function excerpt(md: string): string {
  return md
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
}

const tabBtn = (active: boolean) =>
  `px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
    active
      ? 'bg-[var(--fill-strong)] text-[var(--ink)]'
      : 'text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)]'
  }`;

export function LibraryView({
  sessions,
  folders,
  onOpenSession,
  onClose,
}: {
  sessions: ChatSession[];
  folders: Folder[];
  onOpenSession: (id: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('research');
  const [query, setQuery] = useState('');
  const [facts, setFacts] = useState<string[]>([]);
  const [confirmWipe, setConfirmWipe] = useState(false);

  useEffect(() => {
    getMemoryFacts()
      .then(setFacts)
      .catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const projectName = useMemo(() => {
    const map = new Map(folders.map((f) => [f.id, f.name]));
    return (s: ChatSession) => (s.folderId ? map.get(s.folderId) ?? null : null);
  }, [folders]);

  // ── Research corpus: every cited assistant reply, across all sessions ──
  const reports = useMemo(() => {
    const out: {
      key: string;
      sessionId: string;
      sessionTitle: string;
      project: string | null;
      when: string;
      ts: number;
      cites: number;
      sources: string[];
      text: string;
    }[] = [];
    for (const s of sessions) {
      for (const m of s.messages ?? []) {
        const n = m.sources?.length ?? 0;
        if (m.role !== 'assistant' || n === 0) continue;
        out.push({
          key: `${s.id}-${m.id}`,
          sessionId: s.id,
          sessionTitle: s.title,
          project: projectName(s),
          when: relTime(m.timestamp),
          ts: m.timestamp ?? 0,
          cites: n,
          sources: (m.sources ?? [])
            .map((src) => String(src.metadata?.filename ?? src.source ?? ''))
            .filter(Boolean)
            .slice(0, 3),
          text: excerpt(m.content),
        });
      }
    }
    return out.sort((a, b) => b.ts - a.ts);
  }, [sessions, projectName]);

  // ── Knowledge layer: every source, deduped, with dependent sessions ──
  const knowledge = useMemo(() => {
    const map = new Map<string, { name: string; kind: string; usedIn: { id: string; title: string }[] }>();
    for (const s of sessions) {
      for (const src of s.uploadedFiles ?? []) {
        const rec = map.get(src) ?? { name: src, kind: sourceKind(src), usedIn: [] };
        rec.usedIn.push({ id: s.id, title: s.title });
        map.set(src, rec);
      }
    }
    return [...map.values()].sort((a, b) => b.usedIn.length - a.usedIn.length);
  }, [sessions]);

  const q = query.trim().toLowerCase();
  const shownReports = q
    ? reports.filter(
        (r) =>
          r.sessionTitle.toLowerCase().includes(q) ||
          r.text.toLowerCase().includes(q) ||
          r.sources.some((s) => s.toLowerCase().includes(q))
      )
    : reports;
  const shownKnowledge = q
    ? knowledge.filter(
        (k) => k.name.toLowerCase().includes(q) || k.usedIn.some((u) => u.title.toLowerCase().includes(q))
      )
    : knowledge;
  const newestFirstFacts = useMemo(() => [...facts].reverse(), [facts]);
  const shownFacts = q
    ? newestFirstFacts.filter((f) => f.toLowerCase().includes(q))
    : newestFirstFacts;

  const forget = (displayIndex: number) => {
    const fact = shownFacts[displayIndex];
    const stored = facts.lastIndexOf(fact);
    if (stored === -1) return;
    deleteMemoryFact(stored)
      .then(setFacts)
      .catch(() => toast.error('Could not remove that.'));
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-[var(--base)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 sm:px-6 h-14 flex-shrink-0 border-b border-[var(--line)] bg-[var(--panel)]">
        <Logo size={26} />
        <h1 className="text-sm font-semibold text-[var(--ink)]">Library</h1>
        <div className="flex items-center gap-1 ml-4">
          <button onClick={() => setTab('research')} className={tabBtn(tab === 'research')}>
            Research{reports.length > 0 && ` · ${reports.length}`}
          </button>
          <button onClick={() => setTab('knowledge')} className={tabBtn(tab === 'knowledge')}>
            Knowledge{knowledge.length > 0 && ` · ${knowledge.length}`}
          </button>
          <button onClick={() => setTab('memory')} className={tabBtn(tab === 'memory')}>
            Memory{facts.length > 0 && ` · ${facts.length}`}
          </button>
        </div>
        <div className="flex-1" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the library…"
          className="hidden sm:block w-56 bg-[var(--fill)] border border-[var(--line)] rounded-lg px-3 py-1.5 text-xs text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)] transition-colors"
        />
        <button
          onClick={onClose}
          aria-label="Close library"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors"
        >
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-6">
          {/* ── Research ── */}
          {tab === 'research' &&
            (shownReports.length === 0 ? (
              <p className="text-sm text-[var(--ink-4)] py-12 text-center">
                {q ? 'No reports match your search.' : 'No cited research yet — run Research in any session and the report lives here forever.'}
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {shownReports.map((r) => (
                  <li key={r.key}>
                    <button
                      onClick={() => onOpenSession(r.sessionId)}
                      className="group w-full text-left px-2 py-3.5 hover:bg-[var(--fill)] transition-colors rounded-lg"
                    >
                      <div className="flex items-center gap-2 text-[11px] text-[var(--ink-4)]">
                        <span className="font-medium text-[var(--ink-2)]">{r.sessionTitle}</span>
                        {r.project && (
                          <span className="px-1.5 py-px rounded border border-[var(--line)] text-[10px]">
                            {r.project}
                          </span>
                        )}
                        <span>
                          {r.cites} citation{r.cites === 1 ? '' : 's'}
                        </span>
                        {r.when && <span>· {r.when}</span>}
                        <span className="ml-auto opacity-0 group-hover:opacity-100 text-[var(--accent-fg)] transition-opacity">
                          Resume →
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] leading-relaxed text-[var(--ink-3)]">{r.text}…</p>
                      {r.sources.length > 0 && (
                        <p className="mt-1 text-[10px] text-[var(--ink-4)] truncate">
                          {r.sources.join(' · ')}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ))}

          {/* ── Knowledge ── */}
          {tab === 'knowledge' &&
            (shownKnowledge.length === 0 ? (
              <p className="text-sm text-[var(--ink-4)] py-12 text-center">
                {q ? 'No sources match your search.' : 'No sources attached yet — pages, videos, repos, and documents you add will be indexed here.'}
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {shownKnowledge.map((k) => (
                  <li key={k.name} className="px-2 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--ink-4)] border border-[var(--line)] rounded px-1.5 py-px flex-shrink-0">
                        {KIND_NAME[k.kind]}
                      </span>
                      <span className="text-[12px] text-[var(--ink)] truncate" title={k.name}>
                        {k.name}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-[var(--ink-4)]">
                      Used in {k.usedIn.length} session{k.usedIn.length === 1 ? '' : 's'}:{' '}
                      {k.usedIn.slice(0, 3).map((u, i) => (
                        <span key={u.id}>
                          {i > 0 && ' · '}
                          <button
                            onClick={() => onOpenSession(u.id)}
                            className="text-[var(--accent-fg)] hover:opacity-75 transition-opacity"
                          >
                            {u.title}
                          </button>
                        </span>
                      ))}
                      {k.usedIn.length > 3 && ` · +${k.usedIn.length - 3} more`}
                    </p>
                  </li>
                ))}
              </ul>
            ))}

          {/* ── Memory ── */}
          {tab === 'memory' && (
            <>
              {facts.length > 0 && (
                <div className="flex items-center justify-between px-2 pb-2">
                  <p className="text-[11px] text-[var(--ink-4)]">
                    {facts.length} fact{facts.length === 1 ? '' : 's'} · newest first · applied to
                    every reply in every session
                  </p>
                  <button
                    onClick={() => setConfirmWipe(true)}
                    className="text-[11px] font-medium text-red-400 hover:text-red-300 transition-colors"
                  >
                    Forget everything
                  </button>
                </div>
              )}
              {shownFacts.length === 0 ? (
                <p className="text-sm text-[var(--ink-4)] py-12 text-center">
                  {q ? 'No memories match your search.' : 'Nothing remembered yet — durable facts about you are learned as you work.'}
                </p>
              ) : (
                <ul className="divide-y divide-[var(--line)]">
                  {shownFacts.map((f, i) => (
                    <li key={`${i}-${f.slice(0, 20)}`} className="group flex items-start gap-3 px-2 py-3">
                      <span className="flex-1 text-[12px] leading-relaxed text-[var(--ink-2)]">{f}</span>
                      <button
                        onClick={() => forget(i)}
                        title="Forget this"
                        aria-label={`Forget: ${f}`}
                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 mt-1 text-[var(--ink-4)] hover:text-red-400 transition-opacity"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      {confirmWipe && (
        <ConfirmModal
          title="Forget everything"
          message="Every remembered fact will be permanently deleted. Replies will no longer be personalized."
          confirmLabel="Forget all"
          danger
          onConfirm={() => {
            clearMemory()
              .then(() => {
                setFacts([]);
                toast.success('Memory cleared');
              })
              .catch(() => toast.error('Could not clear memory.'));
            setConfirmWipe(false);
          }}
          onClose={() => setConfirmWipe(false)}
        />
      )}
    </div>,
    document.body
  );
}
