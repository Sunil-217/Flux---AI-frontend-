'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

export function useCodeSessions() {
  const [sessions, setSessions] = useState<CodeSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const loaded = useRef(false);

  // Load once on mount.
  useEffect(() => {
    let initial: CodeSession[] = [];
    try {
      const raw = localStorage.getItem(CODE_SESSIONS_KEY);
      const arr = raw ? JSON.parse(raw) : null;
      if (Array.isArray(arr)) initial = arr as CodeSession[];
    } catch {
      /* ignore */
    }
    if (!initial.length) initial = [newSession()];
    setSessions(initial);
    let active = initial[0].id;
    try {
      const savedActive = sessionStorage.getItem(ACTIVE_CODE_KEY);
      if (savedActive && initial.some((s) => s.id === savedActive)) active = savedActive;
    } catch {
      /* ignore */
    }
    setActiveId(active);
    loaded.current = true;
  }, []);

  // Persist on change (after the initial load).
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(CODE_SESSIONS_KEY, JSON.stringify(sessions.slice(0, 100)));
    } catch {
      /* quota — non-fatal */
    }
  }, [sessions]);

  useEffect(() => {
    if (!loaded.current || !activeId) return;
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
