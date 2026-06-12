'use client';

/**
 * The Agenda — the next-state layer (Home = current, Library = accumulated,
 * Agenda = next).
 *
 * Every item is DERIVED from the user's own activity with its evidence shown
 * inline. Nothing is generated, scored, or recommended by a model; if the
 * data produces no items, the Agenda renders nothing at all — momentum, not
 * a dashboard.
 *
 * Signals (priority order):
 *  1. Unfinished   — last message is the user's with no reply, or the last
 *                    generation errored. Work was interrupted mid-thought.
 *  2. Active research — a cited reply produced in the last 48h.
 *  3. Knowledge to use — sources attached but barely queried (≤2 questions).
 *  4. Dormant project  — a project untouched for 7+ days with real history.
 */

import { useMemo } from 'react';
import type { ChatSession, Folder } from '@/types';

export interface AgendaItem {
  key: string;
  kind: 'unfinished' | 'research' | 'knowledge' | 'dormant';
  label: string;
  title: string;
  evidence: string;
  sessionId: string;
}

const KIND_LABEL: Record<AgendaItem['kind'], string> = {
  unfinished: 'Unfinished',
  research: 'Active research',
  knowledge: 'Knowledge to use',
  dormant: 'Dormant project',
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

const DAY = 86_400_000;

/** Compute agenda items from real activity. Exported so the Home can exclude
 *  agenda sessions from its generic "Continue" list (no duplicate rows). */
export function deriveAgenda(
  sessions: ChatSession[],
  folders: Folder[],
  currentSessionId?: string
): AgendaItem[] {
  const now = Date.now();
  const active = sessions.filter(
    (s) => s.id !== currentSessionId && !s.archived && (s.messages?.length ?? 0) > 0
  );
  const items: AgendaItem[] = [];

  // 1. Unfinished — interrupted threads (max 2, newest first).
  const unfinished = active
    .filter((s) => {
      const last = s.messages[s.messages.length - 1];
      return last && (last.role === 'user' || (last.role === 'assistant' && last.error));
    })
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, 2);
  for (const s of unfinished) {
    const last = s.messages[s.messages.length - 1];
    items.push({
      key: `unfinished-${s.id}`,
      kind: 'unfinished',
      label: KIND_LABEL.unfinished,
      title: s.title,
      evidence:
        last.role === 'user'
          ? `Your last question went unanswered · ${relTime(s.updatedAt)}`
          : `Last generation failed — retry it · ${relTime(s.updatedAt)}`,
      sessionId: s.id,
    });
  }
  const taken = new Set(items.map((i) => i.sessionId));

  // 2. Active research — hottest cited thread of the last 48h (max 1).
  let hot: { s: ChatSession; ts: number; cites: number } | null = null;
  for (const s of active) {
    if (taken.has(s.id)) continue;
    let cites = 0;
    let lastTs = 0;
    for (const m of s.messages) {
      const n = m.sources?.length ?? 0;
      if (n > 0) {
        cites += n;
        lastTs = Math.max(lastTs, m.timestamp ?? 0);
      }
    }
    if (cites > 0 && now - lastTs < 2 * DAY && (!hot || lastTs > hot.ts)) {
      hot = { s, ts: lastTs, cites };
    }
  }
  if (hot) {
    items.push({
      key: `research-${hot.s.id}`,
      kind: 'research',
      label: KIND_LABEL.research,
      title: hot.s.title,
      evidence: `${hot.cites} citation${hot.cites === 1 ? '' : 's'} gathered · last cited ${relTime(hot.ts)}`,
      sessionId: hot.s.id,
    });
    taken.add(hot.s.id);
  }

  // 3. Knowledge to use — sources attached but barely queried (max 1).
  const underused = active
    .filter((s) => {
      if (taken.has(s.id)) return false;
      const sources = s.uploadedFiles?.length ?? 0;
      const questions = s.messages.filter((m) => m.role === 'user').length;
      return sources > 0 && questions <= 2;
    })
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
  if (underused) {
    const sources = underused.uploadedFiles?.length ?? 0;
    const questions = underused.messages.filter((m) => m.role === 'user').length;
    items.push({
      key: `knowledge-${underused.id}`,
      kind: 'knowledge',
      label: KIND_LABEL.knowledge,
      title: underused.title,
      evidence: `${sources} source${sources === 1 ? '' : 's'} attached, only ${questions} question${questions === 1 ? '' : 's'} asked`,
      sessionId: underused.id,
    });
    taken.add(underused.id);
  }

  // 4. Dormant project — quiet 7+ days, substantial history (max 1).
  let dormant: { name: string; sid: string; idleDays: number; chats: number; msgs: number } | null =
    null;
  for (const f of folders) {
    const inProject = active.filter((s) => s.folderId === f.id && !taken.has(s.id));
    if (inProject.length === 0) continue;
    const newest = Math.max(...inProject.map((s) => s.updatedAt ?? 0));
    const msgs = inProject.reduce((n, s) => n + s.messages.length, 0);
    const idleDays = Math.floor((now - newest) / DAY);
    if (idleDays >= 7 && msgs >= 6 && (!dormant || msgs > dormant.msgs)) {
      const resume = inProject.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
      dormant = { name: f.name, sid: resume.id, idleDays, chats: inProject.length, msgs };
    }
  }
  if (dormant) {
    items.push({
      key: `dormant-${dormant.sid}`,
      kind: 'dormant',
      label: KIND_LABEL.dormant,
      title: dormant.name,
      evidence: `Quiet for ${dormant.idleDays} days · ${dormant.chats} session${dormant.chats === 1 ? '' : 's'}, ${dormant.msgs} messages`,
      sessionId: dormant.sid,
    });
  }

  return items.slice(0, 5);
}

export function Agenda({
  sessions,
  folders,
  currentSessionId,
  onSelectSession,
}: {
  sessions: ChatSession[];
  folders: Folder[];
  currentSessionId?: string;
  onSelectSession: (id: string) => void;
}) {
  const items = useMemo(
    () => deriveAgenda(sessions, folders, currentSessionId),
    [sessions, folders, currentSessionId]
  );

  // No signals → no surface. Momentum, not furniture.
  if (items.length === 0) return null;

  return (
    <section className="mb-7">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-4)] mb-2">
        Next
      </p>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it.key}>
            <button
              onClick={() => onSelectSession(it.sessionId)}
              className="group flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--fill)] hover:bg-[var(--fill-hover)] transition-colors"
            >
              <span
                className={`flex-shrink-0 text-[9px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 ${
                  it.kind === 'unfinished'
                    ? 'text-[var(--accent-fg)] border border-[var(--accent)]/40'
                    : 'text-[var(--ink-4)] border border-[var(--line)]'
                }`}
              >
                {it.label}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-[var(--ink)] truncate">{it.title}</span>
                <span className="block text-[11px] text-[var(--ink-4)]">{it.evidence}</span>
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
  );
}
