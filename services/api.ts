import axios, { AxiosError } from 'axios';
import type { Source, ChatSession, User } from '@/types';
import { featureEnabledCached } from '@/lib/features';

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

/** Signup result. For a designated admin email the server skips OTP and returns
 *  a token (auto_login) so we log in immediately; everyone else gets the OTP flow. */
export interface SignupResult {
  auto_login?: boolean;
  access_token?: string;
  token_type?: string;
  user?: User;
  message?: string;
  email?: string;
}

export async function signup(body: {
  name: string;
  email: string;
  password: string;
  phone: string;
}): Promise<SignupResult> {
  const res = await client.post<SignupResult>('/auth/signup', body);
  return res.data;
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

export async function updateProfile(
  name: string,
  phone?: string,
  avatar?: string | null,
): Promise<User> {
  const res = await client.post<User>('/auth/profile', { name, phone, avatar });
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
  plan?: string;
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

/** Transcribe an uploaded video/audio file (Groq Whisper) and index it for Q&A. */
export async function uploadVideo(file: File, chatId: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('chat_id', chatId);
  const res = await client.post<{ source?: string }>('/upload-video', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180_000, // transcription of longer clips can take a while
  });
  return res.data.source || file.name;
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
    // Each preference is sent only if its feature is enabled platform-wide.
    const style = featureEnabledCached('response_style') ? localStorage.getItem(STYLE_KEY) || '' : '';
    const ci = featureEnabledCached('custom_instructions')
      ? (localStorage.getItem(CUSTOM_INSTRUCTIONS_KEY) || '').trim()
      : '';
    const folder = (localStorage.getItem(FOLDER_INSTRUCTIONS_KEY) || '').trim();
    const persona = featureEnabledCached('personas')
      ? (localStorage.getItem(PERSONA_PROMPT_KEY) || '').trim()
      : '';
    // Persona first (it defines the assistant), then folder (project) context,
    // then the user's global instructions.
    const combined = [persona, folder, ci].filter(Boolean).join('\n\n');
    if (style && style !== 'default') out.style = style;
    if (combined) out.custom_instructions = combined;
    // Off if the user disabled it OR an admin disabled the feature platform-wide.
    if (localStorage.getItem(WEB_SEARCH_KEY) === 'off' || !featureEnabledCached('web_search')) {
      out.web_search = false;
    }
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

// ── Admin control panel (/admin/* — platform-admin only) ──
export interface AdminStats {
  users: {
    total: number;
    verified: number;
    unverified: number;
    admins: number;
    banned: number;
    new_7d: number;
    new_30d: number;
  };
  content: {
    chats: number;
    api_keys: number;
    active_api_keys: number;
    api_calls: number;
    shared_chats: number;
    memory_users: number;
  };
  signups_by_day: { date: string; count: number }[];
  top_users: { id: number; name: string; email: string; chat_count: number }[];
  system: {
    database: string;
    environment: string;
    providers: { nvidia: boolean; groq: boolean; tavily: boolean; email: boolean };
  };
  recent_signups: {
    id: number;
    name: string;
    email: string;
    is_verified: boolean;
    created_at: string | null;
  }[];
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  is_verified: boolean;
  is_admin: boolean;
  is_banned: boolean;
  api_blocked: boolean; // blocked from the developer API (keys disabled + no new keys)
  is_protected: boolean; // bootstrapped superadmin — can't be demoted/banned/deleted
  created_at: string | null;
  chat_count: number;
  api_key_count: number;
}

export interface AdminUserPatch {
  is_verified?: boolean;
  is_admin?: boolean;
  is_banned?: boolean;
  api_blocked?: boolean;
}

export interface AdminAuditEntry {
  id: number;
  actor_email: string;
  action: string;
  target_email: string | null;
  detail: string | null;
  created_at: string | null;
}

export async function adminStats(): Promise<AdminStats> {
  const res = await client.get<AdminStats>('/admin/stats');
  return res.data;
}

export async function adminListUsers(
  q = '',
  limit = 50,
  offset = 0
): Promise<{ total: number; users: AdminUser[] }> {
  const res = await client.get<{ total: number; users: AdminUser[] }>('/admin/users', {
    params: { q, limit, offset },
  });
  return res.data;
}

export async function adminUpdateUser(id: number, patch: AdminUserPatch): Promise<AdminUser> {
  const res = await client.patch<AdminUser>(`/admin/users/${id}`, patch);
  return res.data;
}

export async function adminDeleteUser(id: number): Promise<void> {
  await client.delete(`/admin/users/${id}`);
}

export async function adminAuditLog(limit = 50): Promise<AdminAuditEntry[]> {
  const res = await client.get<{ entries: AdminAuditEntry[] }>('/admin/audit', {
    params: { limit },
  });
  return res.data.entries ?? [];
}

// Admin view of any user's developer API keys (audit / revoke / delete).
export interface AdminApiKey {
  id: number;
  name: string;
  prefix: string;
  revoked: boolean;
  usage_count: number;
  total_tokens: number;
  created_at?: string | null;
  last_used_at?: string | null;
}

export async function adminUserApiKeys(userId: number): Promise<AdminApiKey[]> {
  const res = await client.get<{ keys: AdminApiKey[] }>(`/admin/users/${userId}/api-keys`);
  return res.data.keys ?? [];
}

export async function adminRevokeApiKey(keyId: number): Promise<void> {
  await client.post(`/admin/api-keys/${keyId}/revoke`);
}

export async function adminDeleteApiKey(keyId: number): Promise<void> {
  await client.delete(`/admin/api-keys/${keyId}`);
}

// ── Developer apps (super-admin: every ck_ key across all users + its KB) ──
export interface AdminApp {
  id: number;
  name: string;
  prefix: string;
  plan: string;
  plan_label: string;
  doc_count: number;
  doc_limit: number;
  near_limit: boolean; // at/over the plan's document limit
  total_size: number; // bytes across all uploaded docs
  usage_count: number;
  total_tokens: number;
  revoked: boolean;
  widget_token: string | null;
  created_at?: string | null;
  last_used_at?: string | null;
  owner_id: number;
  owner_email: string | null;
  owner_name: string | null;
  owner_api_blocked: boolean;
  owner_banned: boolean;
}

export interface AdminAppPlanCount {
  key: string;
  label: string;
  price: string;
  count: number;
}

export interface AdminAppsSummary {
  total_apps: number;
  active_apps: number;
  revoked_apps: number;
  developers: number;
  total_docs: number;
  total_size: number;
  api_calls: number;
  plans: AdminAppPlanCount[];
}

export interface AdminAppDocument {
  id: number;
  filename: string;
  file_size: number;
  chunk_count: number;
  uploaded_at: string | null;
}

export interface AdminAppDocuments {
  key_id: number;
  name: string;
  plan: string;
  plan_label: string;
  doc_limit: number;
  owner_email: string | null;
  documents: AdminAppDocument[];
}

export interface AdminAppActivityEvent {
  type: string;
  label: string;
  at: string | null;
  detail?: string | null;
}

export interface AdminAppActivity {
  key_id: number;
  events: AdminAppActivityEvent[];
  footprint: {
    plan: string;
    plan_label: string;
    doc_count: number;
    doc_limit: number;
    total_size: number;
    usage_count: number;
    total_tokens: number;
  };
}

export interface AdminListAppsParams {
  q?: string;
  plan?: string;
  status?: 'all' | 'active' | 'revoked';
  sort?: 'recent' | 'created' | 'usage' | 'docs';
  limit?: number;
  offset?: number;
}

export async function adminListApps(
  params: AdminListAppsParams = {}
): Promise<{ total: number; apps: AdminApp[] }> {
  const res = await client.get<{ total: number; apps: AdminApp[] }>('/admin/apps', { params });
  return { total: res.data.total ?? 0, apps: res.data.apps ?? [] };
}

export async function adminAppsSummary(): Promise<AdminAppsSummary> {
  const res = await client.get<AdminAppsSummary>('/admin/apps/summary');
  return res.data;
}

export async function adminAppDocuments(keyId: number): Promise<AdminAppDocuments> {
  const res = await client.get<AdminAppDocuments>(`/admin/api-keys/${keyId}/documents`);
  return res.data;
}

export async function adminAppActivity(keyId: number): Promise<AdminAppActivity> {
  const res = await client.get<AdminAppActivity>(`/admin/api-keys/${keyId}/activity`);
  return res.data;
}

export async function adminSetAppPlan(keyId: number, plan: string): Promise<AdminApp> {
  const res = await client.patch<AdminApp>(`/admin/api-keys/${keyId}`, { plan });
  return res.data;
}

export async function adminDeleteAppDocument(keyId: number, docId: number): Promise<void> {
  await client.delete(`/admin/api-keys/${keyId}/documents/${docId}`);
}

// ── Plan management (super-admin: edit pricing + services per tier) ──
export interface AdminPlan {
  key: string;
  label: string;
  price: string;
  doc_limit: number;
  rate_limit: number;
  blurb: string;
  features: string[];
  sort_order: number;
  active: boolean;
  highlighted: boolean;
  app_count: number;
}

export interface AdminPlanInput {
  key: string;
  label: string;
  price: string;
  doc_limit: number;
  rate_limit: number;
  blurb: string;
  features: string[];
  highlighted: boolean;
  active: boolean;
}

export type AdminPlanPatch = Partial<Omit<AdminPlanInput, 'key'>> & { sort_order?: number };

export async function adminListPlans(): Promise<AdminPlan[]> {
  const res = await client.get<{ plans: AdminPlan[] }>('/admin/plans');
  return res.data.plans ?? [];
}

export async function adminCreatePlan(input: AdminPlanInput): Promise<AdminPlan> {
  const res = await client.post<AdminPlan>('/admin/plans', input);
  return res.data;
}

export async function adminUpdatePlan(key: string, patch: AdminPlanPatch): Promise<AdminPlan> {
  const res = await client.patch<AdminPlan>(`/admin/plans/${key}`, patch);
  return res.data;
}

export async function adminDeletePlan(key: string): Promise<void> {
  await client.delete(`/admin/plans/${key}`);
}

// ── Feature flags ──
export type FeatureMap = Record<string, boolean>;

/** Public — the effective platform feature flags (what's enabled for users). */
export async function getFeatures(): Promise<FeatureMap> {
  const res = await client.get<{ features: FeatureMap }>('/features');
  return res.data.features ?? {};
}

/** Admin — read the full flag map. */
export async function adminGetFeatures(): Promise<FeatureMap> {
  const res = await client.get<{ features: FeatureMap }>('/admin/features');
  return res.data.features ?? {};
}

/** Admin — toggle one or more flags; returns the new effective map. */
export async function adminSetFeatures(updates: FeatureMap): Promise<FeatureMap> {
  const res = await client.patch<{ features: FeatureMap }>('/admin/features', {
    features: updates,
  });
  return res.data.features ?? {};
}

// ── Broadcast (admin announcement banner) ──
export type BroadcastLevel = 'info' | 'warning' | 'success';

export interface Broadcast {
  id: number;
  message: string;
  level: BroadcastLevel;
  created_at: string | null;
}

export interface AdminBroadcast extends Broadcast {
  active: boolean;
  created_by: string | null;
}

/** Public — the currently-active announcement, or null. */
export async function getBroadcast(): Promise<Broadcast | null> {
  const res = await client.get<{ broadcast: Broadcast | null }>('/broadcast');
  return res.data.broadcast ?? null;
}

export async function adminListBroadcasts(): Promise<AdminBroadcast[]> {
  const res = await client.get<{ broadcasts: AdminBroadcast[] }>('/admin/broadcasts');
  return res.data.broadcasts ?? [];
}

export async function adminCreateBroadcast(
  message: string,
  level: BroadcastLevel,
  opts?: { subject?: string; emailUsers?: boolean }
): Promise<AdminBroadcast & { emailed?: number }> {
  const res = await client.post<AdminBroadcast & { emailed?: number }>('/admin/broadcasts', {
    message,
    level,
    subject: opts?.subject,
    email_users: opts?.emailUsers ?? false,
  });
  return res.data;
}

/** How many users an email announcement would reach (verified, not banned). */
export async function announcementAudience(): Promise<number> {
  const res = await client.get<{ recipients: number }>('/admin/announcement-audience');
  return res.data.recipients ?? 0;
}

// ── Per-user activity timeline (admin) ──
export interface UserActivityEvent {
  type: string;
  label: string | null; // null → frontend maps `type` to a friendly label
  detail: string | null;
  actor: string | null; // admin who performed an action ON this user, if any
  at: string | null;
}
export interface UserActivity {
  footprint: { chats: number; api_keys: number; memory_facts: number; shared_chats: number };
  events: UserActivityEvent[];
}

export async function adminUserActivity(userId: number): Promise<UserActivity> {
  const res = await client.get<UserActivity>(`/admin/users/${userId}/activity`);
  return res.data;
}

export async function adminSetBroadcastActive(id: number, active: boolean): Promise<AdminBroadcast> {
  const res = await client.patch<AdminBroadcast>(`/admin/broadcasts/${id}`, { active });
  return res.data;
}

export async function adminDeleteBroadcast(id: number): Promise<void> {
  await client.delete(`/admin/broadcasts/${id}`);
}

// ── Invites (admin-issued onboarding links) ──
export interface AdminInvite {
  id: number;
  email: string;
  invited_by: string | null;
  accepted: boolean;
  expired: boolean;
  expires_at: string | null;
  created_at: string | null;
  link: string;
}

export async function adminListInvites(): Promise<AdminInvite[]> {
  const res = await client.get<{ invites: AdminInvite[] }>('/admin/invites');
  return res.data.invites ?? [];
}

export async function adminCreateInvite(email: string): Promise<AdminInvite> {
  const res = await client.post<AdminInvite>('/admin/invites', { email });
  return res.data;
}

export async function adminDeleteInvite(id: number): Promise<void> {
  await client.delete(`/admin/invites/${id}`);
}

/** Public — validate an invite link (drives the accept screen). */
export interface InviteCheck {
  email: string;
  valid: boolean;
}

export async function checkInvite(token: string): Promise<InviteCheck> {
  const res = await client.get<InviteCheck>(`/invite/${token}`);
  return res.data;
}

/** Public — accept an invite: set name + password, returns an auth token. */
export async function acceptInvite(body: {
  token: string;
  name: string;
  password: string;
  phone?: string;
}): Promise<AuthResult> {
  const res = await client.post<AuthResult>('/invite/accept', body);
  return res.data;
}

// ── Webhooks (admin-registered outbound event notifications) ──
export interface AdminWebhook {
  id: number;
  url: string;
  events: string[];
  enabled: boolean;
  created_by: string | null;
  last_status: string | null;
  last_triggered_at: string | null;
  created_at: string | null;
  secret?: string; // returned ONCE, only on creation
}

export async function adminListWebhooks(): Promise<{ webhooks: AdminWebhook[]; events: string[] }> {
  const res = await client.get<{ webhooks: AdminWebhook[]; events: string[] }>('/admin/webhooks');
  return { webhooks: res.data.webhooks ?? [], events: res.data.events ?? [] };
}

export async function adminCreateWebhook(url: string, events: string[]): Promise<AdminWebhook> {
  const res = await client.post<AdminWebhook>('/admin/webhooks', { url, events });
  return res.data;
}

export async function adminUpdateWebhook(
  id: number,
  patch: { enabled?: boolean; events?: string[] }
): Promise<AdminWebhook> {
  const res = await client.patch<AdminWebhook>(`/admin/webhooks/${id}`, patch);
  return res.data;
}

export async function adminDeleteWebhook(id: number): Promise<void> {
  await client.delete(`/admin/webhooks/${id}`);
}

/** Send a sample event now; returns the delivery status string (e.g. "200"). */
export async function adminTestWebhook(id: number): Promise<string> {
  const res = await client.post<{ ok: boolean; last_status: string | null }>(`/admin/webhooks/${id}/test`);
  return res.data.last_status ?? 'unknown';
}

// ── Per-app RAG knowledge base (built on developer ck_ keys) ──────────────────

export interface PlanTier {
  key: string;
  label: string;
  price: string;
  doc_limit: number;
  blurb: string;
  rate_limit?: number;
  features?: string[];
  highlighted?: boolean;
  active?: boolean;
  sort_order?: number;
}

export interface KbDocument {
  id: number;
  filename: string;
  file_size: number;
  chunk_count: number;
  uploaded_at: string | null;
}

export interface KbInfo {
  key_id: number;
  name: string;
  plan: string;
  doc_limit: number;
  doc_count: number;
  widget_token: string;
  documents: KbDocument[];
}

/** Plan tiers (display-only pricing; doc limits are enforced server-side). */
export async function getPlans(): Promise<PlanTier[]> {
  const res = await client.get<{ plans: PlanTier[] }>('/plans');
  return res.data.plans ?? [];
}

/** Owner view: an app's knowledge base + plan + docs + public widget token. */
export async function getKb(keyId: number): Promise<KbInfo> {
  const res = await client.get<KbInfo>(`/api-keys/${keyId}/kb`);
  return res.data;
}

export async function uploadKbDocument(
  keyId: number,
  file: File
): Promise<KbDocument & { message: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await client.post<KbDocument & { message: string }>(
    `/api-keys/${keyId}/documents`,
    form
  );
  return res.data;
}

export async function deleteKbDocument(keyId: number, docId: number): Promise<void> {
  await client.delete(`/api-keys/${keyId}/documents/${docId}`);
}

/** End-user RAG chat — authenticated by the public widget token (wk_...). */
export async function ragChat(
  widgetToken: string,
  question: string,
  history: { role: string; content: string }[]
): Promise<{ answer: string; sources: { content: string; filename: string }[] }> {
  const res = await client.post<{ answer: string; sources: { content: string; filename: string }[] }>(
    '/v1/rag/chat',
    { question, history },
    { headers: { 'X-Widget-Token': widgetToken } }
  );
  return res.data;
}
