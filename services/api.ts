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

export async function askQuestion(
  chatId: string,
  question: string
): Promise<ChatResponse> {
  const response = await client.post<ChatResponse>('/chat', {
    chat_id: chatId,
    question,
  });
  return response.data;
}
