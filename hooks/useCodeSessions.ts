'use client';

import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { CodeSession, CodeChatMessage } from '@/types';

// Code-mode conversations live ONLY here (browser localStorage) — never on the
// server and never in the Chat-mode store, so the two memories stay isolated.
const CODE_SESSIONS_KEY = 'close_ai_code_sessions';
const ACTIVE_CODE_KEY = 'close_ai_active_code'; // which code chat is open (per tab)

const welcome = (): CodeChatMessage => ({
  id: 0,
  role: 'assistant',
  text: "New code chat. Open a project folder, then tell me what to build, change, or explain.",
});

function newSession(): CodeSession {
  const now = Date.now();
  return {
    id: uuidv4(),
    title: 'New code chat',
    messages: [welcome()],
    createdAt: now,
    updatedAt: now,
  };
}

/** Saved code chats, or a fresh one when there are none. */
function readSessions(): CodeSession[] {
  try {
    const raw = localStorage.getItem(CODE_SESSIONS_KEY);
    const arr = raw ? JSON.parse(raw) : null;
    if (Array.isArray(arr) && arr.length) return arr as CodeSession[];
  } catch {
    /* ignore */
  }
  return [newSession()];
}

/** The code chat this tab was last on, if it still exists. */
function readActiveId(sessions: CodeSession[]): string {
  try {
    const saved = sessionStorage.getItem(ACTIVE_CODE_KEY);
    if (saved && sessions.some((s) => s.id === saved)) return saved;
  } catch {
    /* ignore */
  }
  return sessions[0].id;
}

export function useCodeSessions() {
  // Read storage straight into the initial state: this hook only runs on the
  // client, so there is nothing to hydrate against and no load flash to cover.
  const [sessions, setSessions] = useState<CodeSession[]>(readSessions);
  const [activeId, setActiveId] = useState<string | null>(() => readActiveId(sessions));

  // Persist on change. Writing the seed back on mount is intentional: it saves
  // the freshly created chat when there was nothing stored.
  useEffect(() => {
    try {
      localStorage.setItem(CODE_SESSIONS_KEY, JSON.stringify(sessions.slice(0, 100)));
    } catch {
      /* quota — non-fatal */
    }
  }, [sessions]);

  useEffect(() => {
    if (!activeId) return;
    try {
      sessionStorage.setItem(ACTIVE_CODE_KEY, activeId);
    } catch {
      /* ignore */
    }
  }, [activeId]);

  const activeSession = sessions.find((s) => s.id === activeId) ?? null;

  const createSession = useCallback(() => {
    const s = newSession();
    setSessions((prev) => [s, ...prev]);
    setActiveId(s.id);
    return s.id;
  }, []);

  const selectSession = useCallback((id: string) => setActiveId(id), []);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        const fresh = newSession();
        setActiveId(fresh.id);
        return [fresh];
      }
      setActiveId((cur) => (cur === id ? next[0].id : cur));
      return next;
    });
  }, []);

  const renameSession = useCallback((id: string, title: string) => {
    const t = title.trim();
    if (!t) return;
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: t.slice(0, 80), updatedAt: Date.now() } : s))
    );
  }, []);

  // Replace a session's messages (called as the Code-mode conversation evolves).
  // Auto-titles the chat from the first real user message.
  const setSessionMessages = useCallback((id: string, messages: CodeChatMessage[]) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        let title = s.title;
        if (title === 'New code chat') {
          const firstUser = messages.find((m) => m.role === 'user' && m.text.trim());
          if (firstUser) title = firstUser.text.trim().slice(0, 48);
        }
        return { ...s, messages, title, updatedAt: Date.now() };
      })
    );
  }, []);

  const setSessionFolder = useCallback((id: string, folderName: string) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, folderName } : s)));
  }, []);

  return {
    codeSessions: sessions,
    activeCodeSession: activeSession,
    activeCodeSessionId: activeId,
    createCodeSession: createSession,
    selectCodeSession: selectSession,
    deleteCodeSession: deleteSession,
    renameCodeSession: renameSession,
    setCodeSessionMessages: setSessionMessages,
    setCodeSessionFolder: setSessionFolder,
  } as const;
}
