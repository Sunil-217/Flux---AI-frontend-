'use client';

import { useState, useCallback, useRef } from 'react';
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
  beginVariant: (sessionId: string, messageId: string) => void;
  patchVariant: (sessionId: string, messageId: string, text: string) => void;
  /** Flush the session to storage once streaming finishes. */
  persist: (sessionId: string) => void;
}

export function useChat(sessionId: string | null, deps: ChatDeps) {
  const { addMessage, patchMessage, beginVariant, patchVariant, persist } = deps;
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Stop the in-flight response (keeps whatever streamed in so far).
  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Shared streaming routine: appends tokens to a single assistant message.
  const runStream = useCallback(
    async (content: string, history: HistoryMessage[], image?: string) => {
      if (!sessionId) return;

      const controller = new AbortController();
      abortRef.current = controller;
      let assistantId: string | null = null;
      let acc = '';
      let pendingSources: Source[] | undefined;
      let streamError = false;

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
        onError: (message) => {
          streamError = true;
          toast.error(message || 'Failed to get a response. Please try again.');
        },
      };

      try {
        await streamQuestion(sessionId, content, history, handlers, image, controller.signal);
        if (!assistantId && !streamError) toast.error('No response received. Please try again.');
      } catch (err) {
        // A user-triggered stop (AbortError) is not an error — keep the partial reply.
        if ((err as Error)?.name !== 'AbortError' && !streamError) {
          toast.error('Failed to get a response. Please try again.');
        }
      } finally {
        abortRef.current = null;
        if (assistantId) persist(sessionId);
      }
    },
    [sessionId, addMessage, patchMessage, persist]
  );

  const sendMessage = useCallback(
    async (content: string, history: HistoryMessage[] = [], image?: string) => {
      if (!sessionId || isLoading) return;
      const text = content.trim();
      if (!text && !image) return;
      addMessage(sessionId, {
        id: uuidv4(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
        image,
      });
      setIsLoading(true);
      await runStream(text || 'Describe this image in detail.', history, image);
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

  // Regenerate as a NEW variant on an existing assistant message (keeps the old answer).
  const regenerateVariant = useCallback(
    async (assistantId: string, content: string, history: HistoryMessage[] = []) => {
      if (!sessionId || isLoading) return;
      setIsLoading(true);
      beginVariant(sessionId, assistantId);
      const controller = new AbortController();
      abortRef.current = controller;
      let acc = '';
      let streamError = false;
      const handlers: StreamHandlers = {
        onToken: (t) => {
          acc += t;
          patchVariant(sessionId, assistantId, acc);
        },
        onSources: (s) => patchMessage(sessionId, assistantId, { sources: s }),
        onError: (message) => {
          streamError = true;
          toast.error(message || 'Failed to get a response. Please try again.');
        },
      };
      try {
        await streamQuestion(sessionId, content, history, handlers, undefined, controller.signal);
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError' && !streamError) {
          toast.error('Failed to get a response. Please try again.');
        }
      } finally {
        abortRef.current = null;
        setIsLoading(false);
        persist(sessionId);
      }
    },
    [sessionId, isLoading, beginVariant, patchVariant, patchMessage, persist]
  );

  return { isLoading, sendMessage, resendQuestion, regenerateVariant, stop } as const;
}
