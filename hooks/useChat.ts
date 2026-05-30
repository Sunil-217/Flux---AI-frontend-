'use client';

import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { askQuestion } from '@/services/api';
import type { HistoryMessage } from '@/services/api';
import type { Message } from '@/types';

type AddMessageFn = (sessionId: string, message: Message) => void;

export function useChat(
  sessionId: string | null,
  addMessage: AddMessageFn
) {
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (content: string, history: HistoryMessage[] = []) => {
      if (!sessionId || !content.trim() || isLoading) return;

      const userMsg: Message = {
        id: uuidv4(),
        role: 'user',
        content: content.trim(),
        timestamp: Date.now(),
      };
      addMessage(sessionId, userMsg);
      setIsLoading(true);

      try {
        const data = await askQuestion(sessionId, content.trim(), history);
        const assistantMsg: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: data.answer,
          timestamp: Date.now(),
          sources: data.sources,
        };
        addMessage(sessionId, assistantMsg);
      } catch {
        toast.error('Failed to get a response. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, isLoading, addMessage]
  );

  // Used after editing a user message: calls the API and adds only the AI reply
  // (the user bubble was already updated by updateMessage in the hook)
  const resendQuestion = useCallback(
    async (content: string, history: HistoryMessage[] = []) => {
      if (!sessionId || isLoading) return;
      setIsLoading(true);
      try {
        const data = await askQuestion(sessionId, content.trim(), history);
        const assistantMsg: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: data.answer,
          timestamp: Date.now(),
          sources: data.sources,
        };
        addMessage(sessionId, assistantMsg);
      } catch {
        toast.error('Failed to get a response. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, isLoading, addMessage]
  );

  return { isLoading, sendMessage, resendQuestion } as const;
}
