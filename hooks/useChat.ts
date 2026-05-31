'use client';

import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { streamQuestion } from '@/services/api';
import type { HistoryMessage, StreamHandlers } from '@/services/api';
import type { Message, Source } from '@/types';

interface ChatDeps {
  addMessage: (sessionId: string, message: Message) => void;
  patchMessage: (
    sessionId: string,
    messageId: string,
    patch: Partial<Message>,
    persistNow?: boolean
  ) => void;
  /** Flush the session to storage once streaming finishes. */
  persist: (sessionId: string) => void;
}

export function useChat(sessionId: string | null, deps: ChatDeps) {
  const { addMessage, patchMessage, persist } = deps;
  const [isLoading, setIsLoading] = useState(false);

  // Shared streaming routine: appends tokens to a single assistant message.
  const runStream = useCallback(
    async (content: string, history: HistoryMessage[]) => {
      if (!sessionId) return;

      let assistantId: string | null = null;
      let acc = '';
      let pendingSources: Source[] | undefined;

      const handlers: StreamHandlers = {
        onToken: (t) => {
          acc += t;
          if (!assistantId) {
            assistantId = uuidv4();
            addMessage(sessionId, {
              id: assistantId,
              role: 'assistant',
              content: acc,
              timestamp: Date.now(),
              sources: pendingSources,
            });
          } else {
            patchMessage(sessionId, assistantId, { content: acc });
          }
        },
        onSources: (s) => {
          pendingSources = s;
          if (assistantId) patchMessage(sessionId, assistantId, { sources: s });
        },
        onError: () => toast.error('Failed to get a response. Please try again.'),
      };

      try {
        await streamQuestion(sessionId, content, history, handlers);
        if (!assistantId) toast.error('No response received. Please try again.');
      } catch {
        toast.error('Failed to get a response. Please try again.');
      } finally {
        if (assistantId) persist(sessionId);
      }
    },
    [sessionId, addMessage, patchMessage, persist]
  );

  const sendMessage = useCallback(
    async (content: string, history: HistoryMessage[] = []) => {
      if (!sessionId || !content.trim() || isLoading) return;
      addMessage(sessionId, {
        id: uuidv4(),
        role: 'user',
        content: content.trim(),
        timestamp: Date.now(),
      });
      setIsLoading(true);
      await runStream(content.trim(), history);
      setIsLoading(false);
    },
    [sessionId, isLoading, addMessage, runStream]
  );

  // After editing a user message: stream a fresh reply (user bubble already updated).
  const resendQuestion = useCallback(
    async (content: string, history: HistoryMessage[] = []) => {
      if (!sessionId || isLoading) return;
      setIsLoading(true);
      await runStream(content.trim(), history);
      setIsLoading(false);
    },
    [sessionId, isLoading, runStream]
  );

  return { isLoading, sendMessage, resendQuestion } as const;
}
