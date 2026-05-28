export interface Source {
  page?: number;
  content?: string;
  source?: string;
  [key: string]: unknown;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sources?: Source[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  uploadedFile?: string;
  createdAt: number;
  updatedAt: number;
}
