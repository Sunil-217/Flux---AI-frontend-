import axios, { AxiosError } from 'axios';
import type { Source, ChatSession, User } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';
const TOKEN_KEY = 'close_ai_token';

const client = axios.create({ baseURL: API_BASE, timeout: 120000 });

// ── Token helpers ──
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// Attach the JWT to every request when present.
client.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

/** Pull the human-readable message out of a FastAPI error response. */
export function apiError(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const detail = (e as AxiosError<{ detail?: string }>)?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}

// ── Auth ──
export interface AuthResult {
  access_token: string;
  token_type: string;
  user: User;
}

export async function signup(body: {
  name: string;
  email: string;
  password: string;
  phone: string;
}): Promise<void> {
  await client.post('/auth/signup', body);
}

export async function verifyOtp(email: string, code: string): Promise<AuthResult> {
  const res = await client.post<AuthResult>('/auth/verify-otp', { email, code });
  return res.data;
}

export async function resendOtp(email: string): Promise<void> {
  await client.post('/auth/resend-otp', { email });
}

export async function signin(email: string, password: string): Promise<AuthResult> {
  const res = await client.post<AuthResult>('/auth/signin', { email, password });
  return res.data;
}

export async function forgotPassword(email: string): Promise<void> {
  await client.post('/auth/forgot-password', { email });
}

export async function resetPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<AuthResult> {
  const res = await client.post<AuthResult>('/auth/reset-password', {
    email,
    code,
    new_password: newPassword,
  });
  return res.data;
}

export async function getMe(): Promise<User> {
  const res = await client.get<User>('/auth/me');
  return res.data;
}

export async function updateProfile(name: string, phone?: string): Promise<User> {
  const res = await client.post<User>('/auth/profile', { name, phone });
  return res.data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await client.post('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

// ── Chats (server-side per-user memory) ──
export async function getChats(): Promise<ChatSession[]> {
  const res = await client.get<{ data: ChatSession[] }>('/chats');
  return res.data.data ?? [];
}

export async function saveChats(sessions: ChatSession[]): Promise<void> {
  await client.put('/chats', { data: sessions });
}

/** Ask the backend for a short, smart title based on the first message. */
export async function generateTitle(question: string): Promise<string> {
  try {
    const res = await client.post<{ title: string }>('/title', { question });
    return res.data.title ?? '';
  } catch {
    return '';
  }
}

/** Suggest follow-up questions based on the last exchange. */
export async function getFollowups(question: string, answer: string): Promise<string[]> {
  try {
    const res = await client.post<{ questions: string[] }>('/followups', { question, answer });
    return res.data.questions ?? [];
  } catch {
    return [];
  }
}

/** Translate text into a target language. */
export async function translateText(text: string, language: string): Promise<string> {
  const res = await client.post<{ text: string }>('/translate', { text, language });
  return res.data.text ?? '';
}

/** Summarise a conversation into a concise markdown summary. */
export async function summarizeConversation(
  history: { role: string; content: string }[]
): Promise<string> {
  const res = await client.post<{ summary: string }>('/summary', { history });
  return res.data.summary ?? '';
}

// ── Read-only share links ──
export interface SharedChat {
  title: string;
  messages: { role: string; content: string; image?: string }[];
  created_at: string;
}

/** Create a public read-only snapshot of a chat; returns its share id. */
export async function createShare(
  title: string,
  messages: { role: string; content: string; image?: string }[]
): Promise<string> {
  const res = await client.post<{ id: string }>('/share', { title, messages });
  return res.data.id;
}

/** Fetch a shared chat snapshot (public — no auth needed). */
export async function getSharedChat(id: string): Promise<SharedChat> {
  const res = await client.get<SharedChat>(`/share/${id}`);
  return res.data;
}

/** Ask the model to edit a code file; returns the full updated contents. */
/** A Code-mode conversation turn, sent to the agent so follow-ups keep context. */
export interface CodeTurn {
  role: 'user' | 'assistant';
  content: string;
}

export async function editCodeFile(
  filename: string,
  content: string,
  instruction: string,
  history: CodeTurn[] = []
): Promise<string> {
  const res = await client.post<{ content: string }>(
    '/edit-file',
    { filename, content, instruction, history },
    // The powerful 480B coder is slower than chat, and the backend may fall back
    // to a second model — give the whole chain generous room before giving up.
    { timeout: 300_000 }
  );
  return res.data.content ?? '';
}

export interface PlanStep {
  path: string;
  action: 'edit' | 'create';
  reason: string;
}

export interface CodePlan {
  mode: 'edit' | 'answer';
  files: PlanStep[];
  notes: string;
}

/** Ask the agent which files to touch (and whether this is a question or an edit). */
export async function agentPlan(
  tree: string[],
  instruction: string,
  history: CodeTurn[] = []
): Promise<CodePlan> {
  const res = await client.post<CodePlan>('/agent-plan', { tree, instruction, history });
  return res.data;
}

export interface CodeContextFile {
  path: string;
  content: string;
}

/** Answer a question about the user's code, given the contents of relevant files. */
export async function answerCodeQuestion(
  question: string,
  files: CodeContextFile[],
  history: CodeTurn[] = []
): Promise<string> {
  const res = await client.post<{ answer: string }>(
    '/code-answer',
    { question, files, history },
    { timeout: 180_000 }
  );
  return res.data.answer;
}

// ── Developer API keys (platform feature: call Close AI like OpenAI) ──
export interface ApiKeyInfo {
  id: number;
  name: string;
  prefix: string;
  revoked: boolean;
  usage_count: number;
  total_tokens: number;
  created_at?: string;
  last_used_at?: string;
}

/** Create a key. The raw `key` is returned ONCE — show it and never again. */
export async function createApiKey(name: string): Promise<{ key: string; info: ApiKeyInfo }> {
  const res = await client.post<{ key: string; info: ApiKeyInfo }>('/api-keys', { name });
  return res.data;
}

export async function listApiKeys(): Promise<ApiKeyInfo[]> {
  const res = await client.get<{ keys: ApiKeyInfo[] }>('/api-keys');
  return res.data.keys ?? [];
}

export async function revokeApiKey(id: number): Promise<void> {
  await client.delete(`/api-keys/${id}`);
}

// ── Deep research, quiz, memory, media sources, neural TTS ──
export interface ResearchSource {
  title: string;
  url: string;
}

/** Multi-step web research with a cited markdown report. Slow (30–90s). */
export async function deepResearch(
  question: string
): Promise<{ report: string; sources: ResearchSource[] }> {
  const res = await client.post<{ report: string; sources: ResearchSource[] }>(
    '/research',
    { question },
    { timeout: 300_000 }
  );
  return res.data;
}

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number; // index into options
  explanation: string;
}

/** Generate a quiz from the chat's uploaded docs (chat_id) or raw content. */
export async function generateQuiz(body: {
  chat_id?: string;
  content?: string;
  count?: number;
}): Promise<QuizQuestion[]> {
  const res = await client.post<{ questions: QuizQuestion[] }>('/quiz', body, {
    timeout: 120_000,
  });
  return res.data.questions ?? [];
}

/** Index a YouTube video's transcript into this chat (then ask questions about it). */
export async function uploadYoutube(url: string, chatId: string): Promise<string> {
  const res = await client.post<{ source: string }>(
    '/upload-youtube',
    { url, chat_id: chatId },
    { timeout: 120_000 }
  );
  return res.data.source ?? url;
}

/** Index a public GitHub repo's code into this chat. */
export async function uploadGithub(url: string, chatId: string): Promise<string> {
  const res = await client.post<{ source: string }>(
    '/upload-github',
    { url, chat_id: chatId },
    { timeout: 180_000 }
  );
  return res.data.source ?? url;
}

/** Neural TTS (edge-tts) — returns MP3 bytes for an answer. */
export async function ttsSpeak(text: string, voice?: string): Promise<Blob> {
  const res = await client.post(
    '/tts',
    { text: text.slice(0, 2000), ...(voice ? { voice } : {}) },
    { responseType: 'blob', timeout: 60_000 }
  );
  return res.data as Blob;
}

/** Fire-and-forget: extract durable user facts from an exchange into memory. */
export async function extractMemory(question: string, answer: string): Promise<void> {
  try {
    await client.post('/memory/extract', { question, answer });
  } catch {
    /* memory is best-effort */
  }
}

export async function getMemoryFacts(): Promise<string[]> {
  const res = await client.get<{ facts: string[] }>('/memory');
  return res.data.facts ?? [];
}

export async function clearMemory(): Promise<void> {
  await client.delete('/memory');
}

export async function deleteMemoryFact(index: number): Promise<string[]> {
  const res = await client.delete<{ facts: string[] }>(`/memory/${index}`);
  return res.data.facts ?? [];
}

// ── Chat with a URL (fetch + index a web page) ──
export async function uploadUrl(url: string, chatId: string): Promise<string> {
  const res = await client.post<{ source: string }>('/upload-url', { url, chat_id: chatId });
  return res.data.source ?? url;
}

// ── PDF upload ──
export async function uploadFile(file: File, chatId: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('chat_id', chatId);
  const res = await client.post<{ filename?: string }>('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.filename || file.name;
}

// ── Streaming chat ──
export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamHandlers {
  onToken: (text: string) => void;
  onSources?: (sources: Source[]) => void;
  onError?: (message: string) => void;
}

// Response-style preferences (set in Settings → Appearance), read at send time.
export const STYLE_KEY = 'close_ai_style';
export const CUSTOM_INSTRUCTIONS_KEY = 'close_ai_custom_instructions';
export const WEB_SEARCH_KEY = 'close_ai_web_search'; // 'off' disables live web grounding
// Instructions for the folder the active chat belongs to (kept in sync by AppLayout).
export const FOLDER_INSTRUCTIONS_KEY = 'close_ai_folder_instructions';
// Active persona's system prompt (set in Settings → Personas).
export const PERSONA_PROMPT_KEY = 'close_ai_persona_prompt';

function responseStylePrefs(): {
  style?: string;
  custom_instructions?: string;
  web_search?: boolean;
} {
  if (typeof window === 'undefined') return {};
  try {
    const out: { style?: string; custom_instructions?: string; web_search?: boolean } = {};
    const style = localStorage.getItem(STYLE_KEY) || '';
    const ci = (localStorage.getItem(CUSTOM_INSTRUCTIONS_KEY) || '').trim();
    const folder = (localStorage.getItem(FOLDER_INSTRUCTIONS_KEY) || '').trim();
    const persona = (localStorage.getItem(PERSONA_PROMPT_KEY) || '').trim();
    // Persona first (it defines the assistant), then folder (project) context,
    // then the user's global instructions.
    const combined = [persona, folder, ci].filter(Boolean).join('\n\n');
    if (style && style !== 'default') out.style = style;
    if (combined) out.custom_instructions = combined;
    if (localStorage.getItem(WEB_SEARCH_KEY) === 'off') out.web_search = false;
    return out;
  } catch {
    return {};
  }
}

// Multi-doc picker: which uploaded docs to query for a chat (localStorage per chat).
export const activeDocsKey = (chatId: string) => `close_ai_docs_${chatId}`;

function activeDocsFor(chatId: string): string[] | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(activeDocsKey(chatId));
    if (!raw) return undefined;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length ? arr : undefined;
  } catch {
    return undefined;
  }
}

export async function streamQuestion(
  chatId: string,
  question: string,
  history: HistoryMessage[] = [],
  handlers: StreamHandlers,
  image?: string,
  signal?: AbortSignal
): Promise<void> {
  const active_docs = activeDocsFor(chatId);
  const token = getToken();
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      chat_id: chatId,
      question,
      history,
      image,
      ...responseStylePrefs(),
      ...(active_docs ? { active_docs } : {}),
    }),
    signal,
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

// ── Delete a session's server data (vectors + uploaded file) ──
export async function deleteChat(chatId: string): Promise<void> {
  await client.delete(`/delete/${chatId}`);
}

// ── Media + document generation (slash commands /image, /video, /pdf) ──

/** Generate an image via NVIDIA NIM FLUX.1-schnell. Returns a data: URI. */
export async function generateImage(prompt: string): Promise<string> {
  const res = await client.post<{ image: string }>(
    '/generate/image',
    { prompt },
    { timeout: 120_000 } // image gen can take 30–90s
  );
  return res.data.image;
}

/** Generate a video via Pollinations.ai. Server proxies the MP4 so the API
 *  key stays on the backend; we receive raw bytes and return them as a Blob. */
export async function generateVideo(prompt: string, duration = 5): Promise<Blob> {
  const res = await client.post('/generate/video', { prompt, duration }, {
    responseType: 'blob',
    timeout: 300_000, // up to 5 min for video generation
  });
  return res.data as Blob;
}

/** A generated document: the file bytes plus the server's suggested filename. */
export interface GeneratedFile {
  blob: Blob;
  filename: string;
}

/** Parse the download filename out of a Content-Disposition header. */
function filenameFromHeaders(headers: unknown, fallback: string): string {
  const cd =
    headers && typeof headers === 'object'
      ? ((headers as Record<string, string>)['content-disposition'] ??
         (headers as Record<string, string>)['Content-Disposition'])
      : undefined;
  if (!cd) return fallback;
  // Handles filename="x.xlsx" and RFC 5987 filename*=UTF-8''x.xlsx
  const star = /filename\*=(?:UTF-8'')?["']?([^"';]+)["']?/i.exec(cd);
  const plain = /filename=["']?([^"';]+)["']?/i.exec(cd);
  const raw = (star?.[1] ?? plain?.[1] ?? '').trim();
  if (!raw) return fallback;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

async function postForFile(
  path: string,
  prompt: string,
  fallback: string
): Promise<GeneratedFile> {
  const res = await client.post(path, { prompt }, {
    responseType: 'blob',
    timeout: 120_000,
  });
  return {
    blob: res.data as Blob,
    filename: filenameFromHeaders(res.headers, fallback),
  };
}

/** Generate a styled PDF document. Returns the file bytes + server filename. */
export async function generatePdf(prompt: string): Promise<GeneratedFile> {
  return postForFile('/generate/pdf', prompt, 'document.pdf');
}

/** Generate an Excel spreadsheet (.xlsx). Returns the file bytes + server filename. */
export async function generateExcel(prompt: string): Promise<GeneratedFile> {
  return postForFile('/generate/excel', prompt, 'spreadsheet.xlsx');
}

/** Generate a Word document (.docx). Returns the file bytes + server filename. */
export async function generateWord(prompt: string): Promise<GeneratedFile> {
  return postForFile('/generate/word', prompt, 'document.docx');
}

/** Generate a PowerPoint presentation (.pptx). Returns the file bytes + server filename. */
export async function generatePpt(prompt: string): Promise<GeneratedFile> {
  return postForFile('/generate/ppt', prompt, 'presentation.pptx');
}
