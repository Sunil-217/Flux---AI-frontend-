import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useChatSessions } from '@/hooks/useChatSessions';
import type { Message } from '@/types';

const userMsg = (id: string, content: string): Message => ({
  id,
  role: 'user',
  content,
  timestamp: 1,
});
const aiMsg = (id: string, content: string): Message => ({
  id,
  role: 'assistant',
  content,
  timestamp: 2,
});

beforeEach(() => localStorage.clear());

describe('useChatSessions', () => {
  it('creates a session and makes it active', () => {
    const { result } = renderHook(() => useChatSessions());
    let id = '';
    act(() => {
      id = result.current.createSession();
    });
    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.activeSessionId).toBe(id);
  });

  it('derives the title from the first user message', () => {
    const { result } = renderHook(() => useChatSessions());
    let id = '';
    act(() => {
      id = result.current.createSession();
    });
    act(() => {
      result.current.addMessage(id, userMsg('m1', 'Explain RAG please'));
    });
    expect(result.current.sessions[0].title).toBe('Explain RAG please');
    expect(result.current.sessions[0].messages).toHaveLength(1);
  });

  it('patchMessage updates content in place without trimming', () => {
    const { result } = renderHook(() => useChatSessions());
    let id = '';
    act(() => {
      id = result.current.createSession();
    });
    act(() => {
      result.current.addMessage(id, userMsg('u1', 'hi'));
      result.current.addMessage(id, aiMsg('a1', ''));
    });
    act(() => {
      result.current.patchMessage(id, 'a1', { content: 'streamed answer' });
    });
    const msgs = result.current.sessions[0].messages;
    expect(msgs).toHaveLength(2);
    expect(msgs[1].content).toBe('streamed answer');
  });

  it('updateMessage edits a message and trims everything after it', () => {
    const { result } = renderHook(() => useChatSessions());
    let id = '';
    act(() => {
      id = result.current.createSession();
    });
    act(() => {
      result.current.addMessage(id, userMsg('u1', 'first'));
      result.current.addMessage(id, aiMsg('a1', 'reply'));
    });
    act(() => {
      result.current.updateMessage(id, 'u1', 'edited');
    });
    const msgs = result.current.sessions[0].messages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe('edited');
  });

  it('deleteMessage removes the user message and its paired reply', () => {
    const { result } = renderHook(() => useChatSessions());
    let id = '';
    act(() => {
      id = result.current.createSession();
    });
    act(() => {
      result.current.addMessage(id, userMsg('u1', 'q'));
      result.current.addMessage(id, aiMsg('a1', 'a'));
    });
    act(() => {
      result.current.deleteMessage(id, 'u1');
    });
    expect(result.current.sessions[0].messages).toHaveLength(0);
  });

  it('deleteSession removes the session', () => {
    const { result } = renderHook(() => useChatSessions());
    let id = '';
    act(() => {
      id = result.current.createSession();
    });
    act(() => {
      result.current.deleteSession(id);
    });
    expect(result.current.sessions).toHaveLength(0);
  });

  it('persists sessions to localStorage', () => {
    const { result } = renderHook(() => useChatSessions());
    act(() => {
      result.current.createSession();
    });
    expect(localStorage.getItem('flux_ai_sessions')).toBeTruthy();
  });
});
