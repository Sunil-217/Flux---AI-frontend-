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

export interface ChatResponse {
  answer: string;
  sources: Source[];
}

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function askQuestion(
  chatId: string,
  question: string,
  history: HistoryMessage[] = []
): Promise<ChatResponse> {
  const response = await client.post<ChatResponse>('/chat', {
    chat_id: chatId,
    question,
    history,
  });
  return response.data;
}

// Deletes session data from the backend (vectors + uploaded file).
// Called alongside the local UI delete. Fails silently if not supported.
export async function deleteChat(chatId: string): Promise<void> {
  await client.delete(`/delete/${chatId}`);
}
