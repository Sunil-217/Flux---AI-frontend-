'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getChats, saveChats } from '@/services/api';
import type { ChatSession, Folder, Message } from '@/types';

// Per-tab key: remembers which chat you're in so a REFRESH restores it, while a
// fresh open (new tab/window) still starts on a new chat. sessionStorage clears
// when the tab closes, so it never "sticks" across a genuinely new visit.
const ACTIVE_CHAT_KEY = 'close_ai_active_chat';
const FOLDERS_KEY = 'close_ai_folders';

export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);

  // Folders live in localStorage (chat → folder assignment persists via the
  // server blob through each session's folderId).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FOLDERS_KEY);
      if (raw) setFolders(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);
  const persistFolders = useCallback((next: Folder[]) => {
    setFolders(next);
    try {
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  // Load this user's chats from the server on mount.
  useEffect(() => {
    let cancelled = false;
    const fresh: ChatSession = {
      id: uuidv4(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    // If we're in the same browser session (a refresh), restore the chat we were
    // in. Otherwise (fresh open) start on a new chat — like Claude/ChatGPT.
    const savedId =
      typeof window !== 'undefined' ? sessionStorage.getItem(ACTIVE_CHAT_KEY) : null;
    // A media generation can't survive a page reload, so any message still
    // flagged `pending` (and without resulting media) is stale — turn it into a
    // retryable error instead of an eternal "Creating image…" spinner.
    const healStale = (list: ChatSession[]): ChatSession[] =>
      list.map((s) => ({
        ...s,
        messages: (s.messages ?? []).map((m) =>
          m.pending && !m.imageUrl && !m.pdfUrl && !m.videoUrl
            ? { ...m, error: true, content: m.content || 'Generation was interrupted — please try again.' }
            : m
        ),
      }));

    getChats()
      .then((raw) => {
        if (cancelled) return;
        const data = healStale(raw ?? []);
        const past = (data ?? []).filter((s) => (s.messages?.length ?? 0) > 0);
        const restored = savedId ? past.find((s) => s.id === savedId) : undefined;
        if (restored) {
          setSessions(past);
          setActiveSessionId(restored.id);
        } else {
          // Drop previously-unused empty chats so "New Chat" entries don't pile up.
          setSessions([fresh, ...past]);
          setActiveSessionId(fresh.id);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setSessions([fresh]);
        setActiveSessionId(fresh.id);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Remember the active chat for THIS tab so a refresh restores it.
  useEffect(() => {
    if (loaded && activeSessionId && typeof window !== 'undefined') {
      sessionStorage.setItem(ACTIVE_CHAT_KEY, activeSessionId);
    }
  }, [activeSessionId, loaded]);

  // Persist to the server whenever sessions change (debounced — handles streaming).
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveChats(sessions).catch(() => {
        /* best-effort */
      });
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [sessions, loaded]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  const createSession = useCallback((): string => {
    const session: ChatSession = {
      id: uuidv4(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    return session.id;
  }, []);

  const updateSession = useCallback(
    (id: string, updates: Partial<ChatSession>) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s))
      );
    },
    []
  );

  // Append a document/URL to a chat (multiple docs per chat) without overwriting.
  const addUploadedFile = useCallback((id: string, filename: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const existing = s.uploadedFiles ?? (s.uploadedFile ? [s.uploadedFile] : []);
        const files = existing.includes(filename) ? existing : [...existing, filename];
        return { ...s, uploadedFile: filename, uploadedFiles: files, updatedAt: Date.now() };
      })
    );
  }, []);

  const addMessage = useCallback((sessionId: string, message: Message) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        const messages = [...s.messages, message];
        const title =
          s.title === 'New Chat' && message.role === 'user'
            ? message.content.slice(0, 48).trimEnd() +
              (message.content.length > 48 ? '…' : '')
            : s.title;
        return { ...s, messages, title, updatedAt: Date.now() };
      })
    );
  }, []);

  // ── Alternate replies (branches) ──
  // Start a fresh variant on an assistant message (keeps the previous answer).
  const beginVariant = useCallback((sessionId: string, messageId: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        return {
          ...s,
          messages: s.messages.map((m) => {
            if (m.id !== messageId) return m;
            const variants = m.variants && m.variants.length ? [...m.variants] : [m.content];
            variants.push('');
            return { ...m, variants, variantIndex: variants.length - 1, content: '' };
          }),
        };
      })
    );
  }, []);

  // Write streaming text into the active variant (and mirror to content).
  const patchVariant = useCallback((sessionId: string, messageId: string, text: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        return {
          ...s,
          messages: s.messages.map((m) => {
            if (m.id !== messageId) return m;
            const variants = m.variants ? [...m.variants] : [text];
            const idx = m.variantIndex ?? variants.length - 1;
            variants[idx] = text;
            return { ...m, variants, content: text };
          }),
        };
      })
    );
  }, []);

  // Switch which variant is shown.
  const setVariant = useCallback((sessionId: string, messageId: string, index: number) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        return {
          ...s,
          messages: s.messages.map((m) => {
            if (m.id !== messageId || !m.variants) return m;
            const i = Math.max(0, Math.min(index, m.variants.length - 1));
            return { ...m, variantIndex: i, content: m.variants[i] };
          }),
        };
      })
    );
  }, []);

  // Merge fields into one message in place (used for streaming tokens).
  const patchMessage = useCallback(
    (sessionId: string, messageId: string, patch: Partial<Message>) => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          const messages = s.messages.map((m) =>
            m.id === messageId ? { ...m, ...patch } : m
          );
          return { ...s, messages };
        })
      );
    },
    []
  );

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setActiveSessionId((cur) => (cur === id ? null : cur));
  }, []);

  // Star / unstar a chat (does not bump updatedAt, so date order is preserved).
  const togglePin = useCallback((id: string) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, pinned: !s.pinned } : s)));
  }, []);

  // Archive / unarchive a chat (archiving also unpins it).
  const toggleArchive = useCallback((id: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, archived: !s.archived, pinned: s.archived ? s.pinned : false } : s
      )
    );
  }, []);

  // ── Folders / projects ──
  const createFolder = useCallback(
    (name: string): string => {
      const folder: Folder = { id: uuidv4(), name: name.trim() || 'New folder' };
      persistFolders([...folders, folder]);
      return folder.id;
    },
    [folders, persistFolders]
  );
  const renameFolder = useCallback(
    (id: string, name: string) => {
      persistFolders(folders.map((f) => (f.id === id ? { ...f, name: name.trim() || f.name } : f)));
    },
    [folders, persistFolders]
  );
  const setFolderInstructions = useCallback(
    (id: string, instructions: string) => {
      persistFolders(folders.map((f) => (f.id === id ? { ...f, instructions } : f)));
    },
    [folders, persistFolders]
  );
  const deleteFolder = useCallback(
    (id: string) => {
      persistFolders(folders.filter((f) => f.id !== id));
      // Un-file any chats that were in this folder.
      setSessions((prev) => prev.map((s) => (s.folderId === id ? { ...s, folderId: null } : s)));
    },
    [folders, persistFolders]
  );
  const assignFolder = useCallback((chatId: string, folderId: string | null) => {
    setSessions((prev) => prev.map((s) => (s.id === chatId ? { ...s, folderId } : s)));
  }, []);

  // Wipe all conversations and start fresh.
  const clearAllSessions = useCallback(() => {
    const fresh: ChatSession = {
      id: uuidv4(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSessions([fresh]);
    setActiveSessionId(fresh.id);
  }, []);

  // Delete a user message (+ its paired AI reply if present).
  const deleteMessage = useCallback((sessionId: string, messageId: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        const idx = s.messages.findIndex((m) => m.id === messageId);
        if (idx === -1) return s;
        const toRemove = new Set([messageId]);
        if (s.messages[idx + 1]?.role === 'assistant') {
          toRemove.add(s.messages[idx + 1].id);
        }
        const messages = s.messages.filter((m) => !toRemove.has(m.id));
        return { ...s, messages, updatedAt: Date.now() };
      })
    );
  }, []);

  // Edit a user message and trim everything after it.
  const updateMessage = useCallback(
    (sessionId: string, messageId: string, newContent: string) => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          const idx = s.messages.findIndex((m) => m.id === messageId);
          if (idx === -1) return s;
          const messages = s.messages
            .slice(0, idx + 1)
            .map((m) =>
              m.id === messageId
                ? { ...m, content: newContent, timestamp: Date.now() }
                : m
            );
          return { ...s, messages, updatedAt: Date.now() };
        })
      );
    },
    []
  );

  return {
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    createSession,
    updateSession,
    addUploadedFile,
    addMessage,
    patchMessage,
    beginVariant,
    patchVariant,
    setVariant,
    deleteSession,
    togglePin,
    toggleArchive,
    folders,
    createFolder,
    renameFolder,
    setFolderInstructions,
    deleteFolder,
    assignFolder,
    clearAllSessions,
    deleteMessage,
    updateMessage,
  };
}
