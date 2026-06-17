'use client';

/**
 * Workspace Home — the landing surface of the intelligence workspace.
 *
 * A returning user must never land on a blank page. This surface answers,
 * from real data: What am I working on? (resume rows), What do I know?
 * (knowledge totals across sessions), What changed? (last cited research,
 * newest memory). New users with no history get the simple welcome instead.
 * Everything is computed from already-loaded sessions + the memory API —
 * no new backend, no settings, no decoration.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Logo } from '@/components/layout/Logo';
import { Agenda, deriveAgenda } from './Agenda';
import { useT } from '@/lib/i18n';
import { getMemoryFacts } from '@/services/api';
import type { ChatSession, Folder } from '@/types';

interface Props {
  hasSession: boolean;
  uploadedFile: string | null;
  onNewChat: () => void;
  allSessions?: ChatSession[];
  allFolders?: Folder[];
  currentSessionId?: string;
  onSelectSession?: (id: string) => void;
  /** Inject a starter prompt into the composer (user can edit before sending). */
  onPickPrompt?: (text: string) => void;
}

/* Capability-hinting starters shown in an empty chat — each drops a prompt
   stub into the composer so a new user always has an obvious first move. */
const STARTERS: { label: string; text: string; icon: ReactNode }[] = [
  {
    label: 'Summarize a document',
    text: 'Summarize the key points of this document: ',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 4H7a2 2 0 01-2-2V6a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
    ),
  },
  {
    label: 'Research a topic',
    text: 'Research the latest developments in ',
    icon: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
      </>
    ),
  },
  {
    label: 'Write code',
    text: 'Write clean, working code that ',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    ),
  },
  {
    label: 'Explain simply',
    text: 'Explain this in simple terms: ',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M7 14a5 5 0 119 0c0 2-2 2.5-2 4H9c0-1.5-2-2-2-4z" />
    ),
  },
];

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

const KIND_LABEL: Record<string, [string, string]> = {
  doc: ['document', 'documents'],
  page: ['web page', 'web pages'],
  repo: ['repository', 'repositories'],
  video: ['video', 'videos'],
};

const sectionHead =
  'text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-4)] mb-2';

export function EmptyState({
  hasSession,
  uploadedFile,
  onNewChat,
  allSessions,
  allFolders,
  currentSessionId,
  onSelectSession,
  onPickPrompt,
}: Props) {
  const t = useT();
  const [facts, setFacts] = useState<string[]>([]);

  useEffect(() => {
    getMemoryFacts()
      .then(setFacts)
      .catch(() => {});
  }, []);

  // ── Workspace intelligence, computed from already-loaded sessions ──
  const home = useMemo(() => {
    const others = (allSessions ?? []).filter(
      (s) => s.id !== currentSessionId && !s.archived && (s.messages?.length ?? 0) > 0
    );
    // Sessions the Agenda already surfaces with a reason shouldn't repeat in
    // the generic Continue list.
    const agendaIds = new Set(
      deriveAgenda(allSessions ?? [], allFolders ?? [], currentSessionId).map((i) => i.sessionId)
    );
    const recent = [...others]
      .filter((s) => !agendaIds.has(s.id))
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      .slice(0, 4)
      .map((s) => ({
        id: s.id,
        title: s.title,
        when: relTime(s.updatedAt),
        msgs: s.messages.length,
        sources: s.uploadedFiles?.length ?? 0,
      }));

    const kinds: Record<string, number> = {};
    let totalSources = 0;
    let citations = 0;
    let lastReport: { title: string; id: string; when: string; cites: number } | null = null;
    for (const s of others) {
      for (const src of s.uploadedFiles ?? []) {
        kinds[sourceKind(src)] = (kinds[sourceKind(src)] ?? 0) + 1;
        totalSources += 1;
      }
      for (const m of s.messages) {
        citations += m.sources?.length ?? 0;
      }
    }
    // Most recent cited reply (research) across sessions:
    let bestTs = 0;
    for (const s of others) {
      for (const m of s.messages) {
        if ((m.sources?.length ?? 0) > 0 && (m.timestamp ?? 0) > bestTs) {
          bestTs = m.timestamp ?? 0;
          lastReport = {
            title: s.title,
            id: s.id,
            when: relTime(m.timestamp),
            cites: m.sources?.length ?? 0,
          };
        }
      }
    }

    const knowledgeSummary = (['doc', 'page', 'repo', 'video'] as const)
      .filter((k) => kinds[k])
      .map((k) => `${kinds[k]} ${KIND_LABEL[k][kinds[k] === 1 ? 0 : 1]}`)
      .join(' · ');

    return { recent, totalSources, knowledgeSummary, citations, lastReport, agendaCount: agendaIds.size };
  }, [allSessions, allFolders, currentSessionId]);

  const isReturning = home.recent.length > 0 || home.agendaCount > 0;

  // ── New user (or no history): simple welcome ──
  if (!isReturning) {
    return (
      <div className="relative flex flex-col items-center justify-center h-full px-6 text-center select-none overflow-hidden">
        <div className="brand-glyph" aria-hidden />
        <div className="relative mb-7">
          <Logo size={68} />
        </div>
        <h2 className="text-3xl sm:text-4xl font-display font-medium mb-3 tracking-tight text-[var(--ink)]">
          {hasSession ? t('What are we working on?') : 'Welcome to Close AI'}
        </h2>
        <p className="text-sm text-[var(--ink-3)] mb-8 max-w-md leading-relaxed">
          {uploadedFile ? (
            <>
              <span className="text-[var(--accent-fg)] font-medium">{uploadedFile}</span> is in
              this session&apos;s knowledge. Ask anything about it.
            </>
          ) : (
            <>
              Attach sources, run cited research, or just ask — each session builds its own
              knowledge, and what matters is remembered across sessions.
            </>
          )}
        </p>
        {!hasSession && (
          <button
            onClick={onNewChat}
            className="btn-3d px-6 py-3 text-sm font-semibold text-white rounded-xl"
          >
            Start a new chat
          </button>
        )}

        {/* Starter prompts — only when a chat is open & ready for input. Each
            drops a stub into the composer so the first move is always obvious. */}
        {hasSession && onPickPrompt && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 max-w-xl">
            {STARTERS.map((s) => (
              <button
                key={s.label}
                onClick={() => onPickPrompt(s.text)}
                className="group inline-flex items-center gap-2 text-[13px] text-[var(--ink-2)] border border-[var(--line)] hover:border-[var(--line-strong)] hover:bg-[var(--fill)] rounded-full px-3.5 py-2 transition-colors"
              >
                <svg
                  className="w-3.5 h-3.5 flex-shrink-0 text-[var(--accent-fg)]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  {s.icon}
                </svg>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Returning user: the Workspace Home ──
  return (
    <div className="relative h-full overflow-y-auto select-none">
      <div className="brand-glyph" aria-hidden />
      <div className="relative max-w-2xl mx-auto w-full px-6 py-10">
        <div className="flex items-center gap-3 mb-1">
          <Logo size={34} />
          <h2 className="text-2xl font-display font-medium tracking-tight text-[var(--ink)]">
            {t('What are we working on?')}
          </h2>
        </div>
        <p className="text-xs text-[var(--ink-4)] mb-8 ml-[46px]">
          Ask below to start fresh — or pick up where you left off.
        </p>

        {/* What should I do next? — derived from your own activity */}
        <Agenda
          sessions={allSessions ?? []}
          folders={allFolders ?? []}
          currentSessionId={currentSessionId}
          onSelectSession={(id) => onSelectSession?.(id)}
        />

        {/* What am I working on? */}
        {home.recent.length > 0 && (
        <section className="mb-7">
          <p className={sectionHead}>Continue</p>
          <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {home.recent.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => onSelectSession?.(r.id)}
                  className="group flex items-center gap-3 w-full text-left px-2 py-2.5 hover:bg-[var(--fill)] transition-colors"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-[var(--ink)] truncate">{r.title}</span>
                    <span className="block text-[11px] text-[var(--ink-4)]">
                      {r.msgs} message{r.msgs === 1 ? '' : 's'}
                      {r.sources > 0 && <> · {r.sources} source{r.sources === 1 ? '' : 's'}</>}
                      {r.when && <> · {r.when}</>}
                    </span>
                  </span>
                  <svg
                    className="w-3.5 h-3.5 flex-shrink-0 text-[var(--ink-4)] opacity-0 group-hover:opacity-100 transition-opacity"
                    fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </section>
        )}

        {/* What do I know? / What changed? */}
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
          <section>
            <p className={sectionHead}>Knowledge</p>
            {home.totalSources === 0 ? (
              <p className="text-[11px] leading-relaxed text-[var(--ink-4)]">
                No sources attached anywhere yet — add pages, videos, repos, or documents to any
                session.
              </p>
            ) : (
              <p className="text-[11px] leading-relaxed text-[var(--ink-3)]">
                <span className="text-[var(--ink-2)]">{home.totalSources} source{home.totalSources === 1 ? '' : 's'}</span>{' '}
                across your sessions — {home.knowledgeSummary}.
                {home.citations > 0 && <> {home.citations} citations gathered so far.</>}
              </p>
            )}
          </section>

          <section>
            <p className={sectionHead}>Recent intelligence</p>
            <p className="text-[11px] leading-relaxed text-[var(--ink-3)]">
              {home.lastReport ? (
                <>
                  Last cited research in{' '}
                  <button
                    onClick={() => onSelectSession?.(home.lastReport!.id)}
                    className="text-[var(--accent-fg)] hover:opacity-75 transition-opacity"
                  >
                    {home.lastReport.title}
                  </button>{' '}
                  — {home.lastReport.cites} source{home.lastReport.cites === 1 ? '' : 's'}
                  {home.lastReport.when && <>, {home.lastReport.when}</>}.
                </>
              ) : (
                <span className="text-[var(--ink-4)]">No cited research yet.</span>
              )}
              {facts.length > 0 && (
                <>
                  {' '}
                  <span className="text-[var(--ink-2)]">{facts.length} active memor{facts.length === 1 ? 'y' : 'ies'}</span>
                  {facts[facts.length - 1] && (
                    <> — newest: &ldquo;{facts[facts.length - 1]}&rdquo;</>
                  )}
                </>
              )}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
