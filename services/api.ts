import axios from 'axios';
import type { Source } from '@/types';

const API_BASE = 'http://127.0.0.1:8000';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 120000,
});

export async function uploadFile(file: File, chatId: string): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('chat_id', chatId);
  await client.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamHandlers {
  onToken: (text: string) => void;
  onSources?: (sources: Source[]) => void;
  onError?: (message: string) => void;
}

/**
 * Streams the answer token-by-token via Server-Sent Events so it appears
 * instantly (ChatGPT-style) instead of waiting for the whole response.
 */
export async function streamQuestion(
  chatId: string,
  question: string,
  history: HistoryMessage[] = [],
  handlers: StreamHandlers
): Promise<void> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, question, history }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';

    for (const chunk of chunks) {
      const line = chunk.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;

      try {
        const evt = JSON.parse(payload) as {
          type: string;
          content?: string;
          sources?: Source[];
          message?: string;
        };
        if (evt.type === 'token' && evt.content) handlers.onToken(evt.content);
        else if (evt.type === 'sources' && evt.sources) handlers.onSources?.(evt.sources);
        else if (evt.type === 'error') handlers.onError?.(evt.message ?? 'Error');
      } catch {
        /* ignore malformed chunk */
      }
    }
  }
}

// Deletes session data from the backend (vectors + uploaded file).
export async function deleteChat(chatId: string): Promise<void> {
  await client.delete(`/delete/${chatId}`);
}
