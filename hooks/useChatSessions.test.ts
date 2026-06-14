import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock the server API so the hook runs offline.
vi.mock('@/services/api', () => ({
  getChats: vi.fn().mockResolvedValue([]),
  saveChats: vi.fn().mockResolvedValue(undefined),
}));

import { useChatSessions } from '@/hooks/useChatSessions';
import type { Message } from '@/types';

const userMsg = (id: string, content: string): Message => ({ id, role: 'user', content, timestamp: 1 });
const aiMsg = (id: string, content: string): Message => ({ id, role: 'assistant', content, timestamp: 2 });

// Mount the hook and flush the initial server load.
async function mount() {
  const hook = renderHook(() => useChatSessions());
  await act(async () => {});
  return hook;
}

describe('useChatSessions', () => {
  it('creates a session and makes it active', async () => {
    const { result } = await mount();
    // The hook seeds a starter "New Chat" on mount (ChatGPT-style), so measure
    // against that baseline rather than assuming an empty list.
    const baseline = result.current.sessions.length;
    let id = '';
    act(() => {
      id = result.current.createSession();
    });
    expect(result.current.sessions).toHaveLength(baseline + 1);
    expect(result.current.sessions[0].id).toBe(id); // newest is prepended
    expect(result.current.activeSessionId).toBe(id);
  });

  it('derives the title from the first user message', async () => {
    const { result } = await mount();
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

  it('patchMessage updates content in place without trimming', async () => {
    const { result } = await mount();
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

  it('updateMessage edits a message and trims everything after it', async () => {
    const { result } = await mount();
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

  it('deleteMessage removes the user message and its paired reply', async () => {
    const { result } = await mount();
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

  it('deleteSession removes the session and clears the active id', async () => {
    const { result } = await mount();
    const baseline = result.current.sessions.length; // mount-time starter chat
    let id = '';
    act(() => {
      id = result.current.createSession();
    });
    act(() => {
      result.current.deleteSession(id);
    });
    // The created session is gone; the starter chat remains, active id cleared.
    expect(result.current.sessions).toHaveLength(baseline);
    expect(result.current.sessions.some((s) => s.id === id)).toBe(false);
    expect(result.current.activeSessionId).toBeNull();
  });
});
