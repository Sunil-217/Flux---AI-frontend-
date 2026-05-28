'use client';

import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ChatSession, Message } from '@/types';

const STORAGE_KEY = 'flux_ai_sessions';

function loadSessions(): ChatSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatSession[]) : [];
  } catch {
    return [];
  }
}

function persist(sessions: ChatSession[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadSessions();
    setSessions(loaded);
    if (loaded.length > 0) setActiveSessionId(loaded[0].id);
  }, []);

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ?? null;

  const createSession = useCallback((): string => {
    const session: ChatSession = {
      id: uuidv4(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSessions((prev) => {
      const updated = [session, ...prev];
      persist(updated);
      return updated;
    });
    setActiveSessionId(session.id);
    return session.id;
  }, []);

  const updateSession = useCallback(
    (id: string, updates: Partial<ChatSession>) => {
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
        );
        persist(updated);
        return updated;
      });
    },
    []
  );

  const addMessage = useCallback(
    (sessionId: string, message: Message) => {
      setSessions((prev) => {
        const updated = prev.map((s) => {
          if (s.id !== sessionId) return s;
          const messages = [...s.messages, message];
          const title =
            s.title === 'New Chat' && message.role === 'user'
              ? message.content.slice(0, 48).trimEnd() +
                (message.content.length > 48 ? '…' : '')
              : s.title;
          return { ...s, messages, title, updatedAt: Date.now() };
        });
        persist(updated);
        return updated;
      });
    },
    []
  );

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const updated = prev.filter((s) => s.id !== id);
        persist(updated);
        return updated;
      });
      setActiveSessionId((prev) => {
        if (prev !== id) return prev;
        const remaining = sessions.filter((s) => s.id !== id);
        return remaining.length > 0 ? remaining[0].id : null;
      });
    },
    [sessions]
  );

  return {
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    createSession,
    updateSession,
    addMessage,
    deleteSession,
  };
}
