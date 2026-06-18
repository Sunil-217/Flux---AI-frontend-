'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  updateProfile,
  changePassword,
  apiError,
  STYLE_KEY,
  CUSTOM_INSTRUCTIONS_KEY,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  getMemoryFacts,
  clearMemory,
  deleteMemoryFact,
  getChats,
  type ApiKeyInfo,
} from '@/services/api';
import type { ChatSession } from '@/types';
import { useT, getLang, setLang, type Lang } from '@/lib/i18n';
import { ConfirmModal } from '@/components/layout/Dialogs';
import { Logo } from '@/components/layout/Logo';
import { DeveloperConsole } from '@/components/layout/DeveloperConsole';
import { UserAvatar, AVATAR_PRESETS } from '@/components/layout/UserAvatar';
import {
  ACCENTS,
  applyAccent,
  ACCENT_KEY,
  applyTextSize,
  TEXT_SIZE_KEY,
  VOICE_KEY,
  TTS_VOICES,
  FONT_KEY,
  FONT_OPTIONS,
  applyFont,
  CODE_FONT_KEY,
  CODE_FONT_OPTIONS,
  applyCodeFont,
} from '@/components/layout/AccentPicker';
import { ttsSpeak } from '@/services/api';
import { useFeatures } from '@/components/providers/FeatureProvider';
import type { FeatureKey } from '@/lib/features';

type Tab =
  | 'account'
  | 'appearance'
  | 'chat'
  | 'data'
  | 'api'
  | 'personas'
  | 'memory'
  | 'insights'
  | 'security'
  | 'about';

const APP_VERSION = '1.0.0';
const NOTIF_KEY = 'close_ai_notify_on_done';
const DENSITY_KEY = 'close_ai_density';

function applyDensity(d: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('density-compact', 'density-comfortable', 'density-spacious');
  const next = d === 'compact' || d === 'spacious' ? d : 'comfortable';
  root.classList.add(`density-${next}`);
}

const inputCls =
  'w-full max-w-sm bg-[var(--fill)] border border-[var(--line)] rounded-lg px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)] transition-colors';
const btnCls =
  'text-sm font-medium rounded-lg bg-[var(--accent)] text-white px-5 py-2 hover:bg-[var(--accent-strong)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors';
const headingCls = 'text-base font-semibold text-[var(--ink)]';
const subCls = 'text-xs text-[var(--ink-3)] mt-0.5';
const fieldLabel = 'block text-xs font-medium text-[var(--ink-3)] mb-1.5';

function setHtmlTheme(theme: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  try {
    localStorage.setItem('theme', theme);
  } catch {
    /* ignore */
  }
}

// Resize a chosen image to a 256px square JPEG data URL — small enough to store
// on the account, center-cropped ("cover").
function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        const SIZE = 256;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('no canvas'));
        const scale = Math.max(SIZE / img.width, SIZE / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Static row (label + description on the left, control on the right). Module-level
// so it never remounts — important so inputs elsewhere keep focus.
function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 py-4 border-b border-[var(--line)] last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--ink)]">{title}</p>
        {desc && <p className="text-xs text-[var(--ink-3)] mt-0.5">{desc}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

// Password input with a show/hide eye toggle. Module-level so it never remounts
// (the input keeps focus while typing).
function PasswordField({
  value,
  onChange,
  show,
  onToggle,
  placeholder,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div className="relative max-w-sm">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete ?? 'off'}
        className={`${inputCls} pr-10`}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md text-[var(--ink-4)] hover:text-[var(--ink-2)] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          {show ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.24A9 9 0 0112 4c5 0 9 4.5 9 8a11.8 11.8 0 01-2.2 3.36M6.1 6.1A11.8 11.8 0 003 12c0 3.5 4 8 9 8a8.9 8.9 0 003.9-.9" />
          ) : (
            <>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}

// Password strength → 0 (weak) … 3 (strong), with a label + bar colour.
function pwStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: -1, label: '', color: 'var(--ink-4)' };
  let s = 0;
  if (pw.length >= 8) s += 1;
  if (pw.length >= 12) s += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s += 1;
  if (/\d/.test(pw)) s += 1;
  if (/[^A-Za-z0-9]/.test(pw)) s += 1;
  const level = s <= 1 ? 0 : s === 2 ? 1 : s === 3 ? 2 : 3;
  return [
    { score: 0, label: 'Weak', color: '#f87171' },
    { score: 1, label: 'Fair', color: '#fbbf24' },
    { score: 2, label: 'Good', color: '#60a5fa' },
    { score: 3, label: 'Strong', color: '#34d399' },
  ][level];
}

// A small ✓ / ○ password-requirement marker.
function ReqItem({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-[11px]">
      <svg
        className={`w-3.5 h-3.5 flex-shrink-0 ${ok ? 'text-emerald-400' : 'text-[var(--ink-4)]'}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        viewBox="0 0 24 24"
      >
        {ok ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        ) : (
          <circle cx="12" cy="12" r="8" />
        )}
      </svg>
      <span className={ok ? 'text-[var(--ink-3)]' : 'text-[var(--ink-4)]'}>{children}</span>
    </li>
  );
}

// API base shown in the quick-start snippet (same one the app itself talks to).
const PUBLIC_API_BASE =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) || 'http://127.0.0.1:8000';

/** Developer platform panel: create / list / revoke API keys + quick-start docs. */
function ApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null); // shown ONCE
  const [revokeId, setRevokeId] = useState<number | null>(null);
  const [consoleOpen, setConsoleOpen] = useState(false);

  const refresh = () =>
    listApiKeys()
      .then(setKeys)
      .catch(() => toast.error('Could not load API keys.'))
      .finally(() => setLoading(false));

  useEffect(() => {
    refresh();
  }, []);

  const create = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const { key } = await createApiKey(newName.trim());
      setFreshKey(key);
      setNewName('');
      refresh();
    } catch (e) {
      toast.error(apiError(e, 'Could not create the key.'));
    } finally {
      setCreating(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success('Copied'))
      .catch(() => toast.error('Copy failed — select it manually.'));
  };

  const active = keys.filter((k) => !k.revoked);
  const pythonSnippet = `from openai import OpenAI

client = OpenAI(
    base_url="${PUBLIC_API_BASE}/v1",
    api_key="ck_...",  # your key
)
r = client.chat.completions.create(
    model="close-chat",  # or "close-code"
    messages=[{"role": "user", "content": "Hello!"}],
)
print(r.choices[0].message.content)`;

  return (
    <>
      {/* Build-a-chatbot hero — opens the full Developer Console */}
      <button
        onClick={() => setConsoleOpen(true)}
        className="w-full text-left mb-6 rounded-2xl border border-[var(--accent)]/40 bg-gradient-to-br from-[var(--accent)]/12 to-transparent p-5 hover:from-[var(--accent)]/16 transition-colors group"
      >
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/15 text-[var(--accent-fg)] flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-9 6l3.5-2H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--ink)] flex items-center gap-1.5">
              Build an AI assistant for your app
              <svg className="w-3.5 h-3.5 text-[var(--ink-3)] group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </p>
            <p className="text-xs text-[var(--ink-3)] mt-1 leading-relaxed">
              Create an app, upload your documents (PDF/Word), and embed a smart chat widget into your
              product — your users get instant answers from <em>your</em> content, powered by Close AI.
            </p>
            <span className="inline-block mt-2.5 text-xs font-medium text-[var(--accent-fg)]">Open Developer Console →</span>
          </div>
        </div>
      </button>

      <div className="mb-5">
        <h3 className={headingCls}>API Keys</h3>
        <p className={subCls}>
          Use Close AI as a service — generate a key and call the OpenAI-compatible API from your
          own apps. Limit: 20 requests/min per key.
        </p>
      </div>

      {/* Create */}
      <div className="flex items-center gap-2 mb-5">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
          placeholder="Key name (e.g. my-app)"
          maxLength={60}
          className={inputCls}
        />
        <button onClick={create} disabled={creating || !newName.trim()} className={btnCls}>
          {creating ? 'Creating…' : 'Create key'}
        </button>
      </div>

      {/* Show-once modal block */}
      {freshKey && (
        <div className="mb-5 p-4 rounded-xl border border-[var(--accent)]/40 bg-[var(--fill)]">
          <p className="text-xs font-medium text-[var(--ink)] mb-1.5">
            Copy your key now — it will never be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 text-[11px] font-mono text-[var(--accent-fg)] bg-[var(--base)] border border-[var(--line)] rounded-lg px-2.5 py-2 break-all select-all">
              {freshKey}
            </code>
            <button onClick={() => copy(freshKey)} className={btnCls}>
              Copy
            </button>
            <button
              onClick={() => setFreshKey(null)}
              className="text-xs text-[var(--ink-3)] hover:text-[var(--ink)] px-2"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Key list */}
      {loading ? (
        <p className="text-xs text-[var(--ink-4)]">Loading…</p>
      ) : active.length === 0 ? (
        <p className="text-xs text-[var(--ink-4)] mb-5">No active keys yet — create one above.</p>
      ) : (
        <div className="space-y-2 mb-6">
          {active.map((k) => (
            <div
              key={k.id}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--fill)]"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--ink)] truncate">{k.name}</p>
                <p className="text-[11px] font-mono text-[var(--ink-4)]">
                  {k.prefix} · {k.usage_count} requests · {k.total_tokens} tokens
                  {k.last_used_at ? ` · last used ${new Date(k.last_used_at).toLocaleDateString()}` : ''}
                </p>
              </div>
              <button
                onClick={() => setRevokeId(k.id)}
                className="text-xs font-medium text-red-400 hover:text-red-300 flex-shrink-0"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Quick start */}
      <div className="pt-4 border-t border-[var(--line)]">
        <p className="text-xs font-semibold text-[var(--ink)] mb-2">Quick start (Python, OpenAI SDK)</p>
        <div className="relative">
          <pre className="text-[11px] font-mono text-[var(--ink-2)] bg-[var(--base)] border border-[var(--line)] rounded-xl p-3 overflow-x-auto whitespace-pre">
            {pythonSnippet}
          </pre>
          <button
            onClick={() => copy(pythonSnippet)}
            className="absolute top-2 right-2 text-[10px] font-medium rounded-md border border-[var(--line)] bg-[var(--fill)] text-[var(--ink-3)] px-2 py-1 hover:text-[var(--ink)]"
          >
            Copy
          </button>
        </div>
        <p className="text-[11px] text-[var(--ink-4)] mt-2">
          Models: <code className="font-mono">close-chat</code> (fast general chat) ·{' '}
          <code className="font-mono">close-code</code> (strongest coder). Streaming is supported
          (<code className="font-mono">stream=True</code>).
        </p>
      </div>

      {revokeId !== null && (
        <ConfirmModal
          title="Revoke key"
          message="Apps using this key will stop working immediately. This can't be undone."
          confirmLabel="Revoke"
          danger
          onConfirm={() => {
            revokeApiKey(revokeId)
              .then(() => {
                toast.success('Key revoked');
                refresh();
              })
              .catch(() => toast.error('Could not revoke the key.'));
            setRevokeId(null);
          }}
          onClose={() => setRevokeId(null)}
        />
      )}

      {consoleOpen && <DeveloperConsole onClose={() => setConsoleOpen(false)} />}
    </>
  );
}

// ── Personas ────────────────────────────────────────────────────────────────

type Persona = { id: string; name: string; emoji: string; prompt: string };

const PERSONAS_KEY = 'close_ai_personas';
const ACTIVE_PERSONA_KEY = 'close_ai_active_persona';
// Integration contract: the chat layer reads this key and injects it into the
// system prompt. Written whenever the active persona changes; removed when none.
const PERSONA_PROMPT_KEY = 'close_ai_persona_prompt';

const STARTER_PERSONAS: Persona[] = [
  {
    id: 'starter-interview-coach',
    name: 'Interview Coach',
    emoji: '',
    prompt:
      'You are a rigorous but encouraging interview coach. Mock-interview the user for the role they mention. Ask exactly one interview question at a time, wait for their answer, then give short honest feedback — strengths, gaps, and a stronger sample answer — before asking the next question.',
  },
  {
    id: 'starter-tamil-teacher',
    name: 'Tamil Teacher',
    emoji: '',
    prompt:
      'You are a friendly Tamil teacher. Explain everything bilingually — first in simple English, then in Tamil (தமிழ்) — using simple words and short sentences. Add transliteration alongside Tamil script when it helps a beginner.',
  },
  {
    id: 'starter-code-reviewer',
    name: 'Code Reviewer',
    emoji: '',
    prompt:
      'You are a meticulous senior code reviewer. When the user pastes code, review it for bugs, security issues, and clean-code improvements. Order findings by severity (critical first, minor last), point to the exact lines, and suggest concrete fixes.',
  },
];

// Seed starters only on the very first load (key absent). An explicitly emptied
// list ('[]') stays empty — deleting all personas must not resurrect them.
function loadPersonas(): Persona[] {
  try {
    const raw = localStorage.getItem(PERSONAS_KEY);
    if (raw === null) {
      localStorage.setItem(PERSONAS_KEY, JSON.stringify(STARTER_PERSONAS));
      return STARTER_PERSONAS;
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Persona[]) : [];
  } catch {
    return [];
  }
}

/** Custom AI personalities — the active one shapes every chat reply. */
function PersonasPanel() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [activeId, setActiveId] = useState('');
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setPersonas(loadPersonas());
    try {
      setActiveId(localStorage.getItem(ACTIVE_PERSONA_KEY) || '');
    } catch {
      /* ignore */
    }
  }, []);

  const persist = (list: Persona[]) => {
    setPersonas(list);
    try {
      localStorage.setItem(PERSONAS_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  };

  // Single place where the active persona (and its prompt contract key) changes.
  const setActive = (p: Persona | null) => {
    setActiveId(p ? p.id : '');
    try {
      if (p) {
        localStorage.setItem(ACTIVE_PERSONA_KEY, p.id);
        localStorage.setItem(PERSONA_PROMPT_KEY, p.prompt);
      } else {
        localStorage.setItem(ACTIVE_PERSONA_KEY, '');
        localStorage.removeItem(PERSONA_PROMPT_KEY);
      }
    } catch {
      /* ignore */
    }
  };

  const create = () => {
    if (!name.trim() || !prompt.trim()) return;
    const p: Persona = {
      id: `persona-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      emoji: '', // avatar is a monogram derived from the name
      prompt: prompt.trim(),
    };
    persist([...personas, p]);
    setName('');
    setPrompt('');
    toast.success('Persona created');
  };

  const remove = (id: string) => {
    persist(personas.filter((x) => x.id !== id));
    if (activeId === id) setActive(null);
    toast.success('Persona deleted');
  };

  return (
    <>
      <div className="mb-5">
        <h3 className={headingCls}>Personas</h3>
        <p className={subCls}>The active persona shapes every reply in chat.</p>
      </div>

      {/* Persona cards */}
      {personas.length === 0 ? (
        <p className="text-xs text-[var(--ink-4)] mb-6">No personas yet — create one below.</p>
      ) : (
        <div className="space-y-2 mb-6">
          {personas.map((p) => {
            const isActive = p.id === activeId;
            return (
              <div
                key={p.id}
                className={`flex items-start gap-3 px-3.5 py-3 rounded-xl border bg-[var(--fill)] transition-colors ${
                  isActive ? 'border-[var(--accent)]' : 'border-[var(--line)]'
                }`}
              >
                {/* Monogram avatar (legacy user-set emoji still honoured) */}
                <span
                  className={`flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold ${
                    isActive
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--fill-strong)] text-[var(--ink-2)] border border-[var(--line)]'
                  }`}
                >
                  {p.emoji || p.name.trim().charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--ink)] truncate">{p.name}</p>
                    {isActive && (
                      <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-white bg-[var(--accent)] rounded-full px-2 py-0.5">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--ink-3)] mt-1 line-clamp-2">{p.prompt}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 mt-0.5">
                  <button
                    onClick={() => setActive(isActive ? null : p)}
                    className={`text-xs font-medium transition-colors ${
                      isActive
                        ? 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                        : 'text-[var(--accent-fg)] hover:opacity-80'
                    }`}
                  >
                    {isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => setDeleteId(p.id)}
                    className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New persona */}
      <div className="pt-5 border-t border-[var(--line)]">
        <p className="text-xs font-semibold text-[var(--ink)] mb-3">New persona</p>
        <div className="mb-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Persona name (e.g. Debate Partner)"
            maxLength={40}
            className={inputCls}
          />
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="System prompt — who is this persona, and how should it reply?"
          className="w-full bg-[var(--fill)] border border-[var(--line)] rounded-lg px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)] transition-colors resize-none"
        />
        <div className="flex justify-end mt-2">
          <button onClick={create} disabled={!name.trim() || !prompt.trim()} className={btnCls}>
            Create
          </button>
        </div>
      </div>

      {deleteId !== null && (
        <ConfirmModal
          title="Delete persona"
          message="This persona will be removed. If it's active, chat goes back to the default personality."
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            remove(deleteId);
            setDeleteId(null);
          }}
          onClose={() => setDeleteId(null)}
        />
      )}
    </>
  );
}

// ── Memory ──────────────────────────────────────────────────────────────────

/** Durable facts Close AI has learned about the user, with per-fact delete. */
function MemoryPanel() {
  const [facts, setFacts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmWipe, setConfirmWipe] = useState(false);

  useEffect(() => {
    getMemoryFacts()
      .then(setFacts)
      .catch(() => toast.error('Could not load memory.'))
      .finally(() => setLoading(false));
  }, []);

  const removeFact = (index: number) => {
    deleteMemoryFact(index)
      .then((next) => {
        setFacts(next);
        toast.success('Fact forgotten');
      })
      .catch(() => toast.error('Could not delete that fact.'));
  };

  const wipe = () => {
    clearMemory()
      .then(() => {
        setFacts([]);
        toast.success('Memory cleared');
      })
      .catch(() => toast.error('Could not clear memory.'));
  };

  return (
    <>
      <div className="mb-5">
        <h3 className={headingCls}>Memory</h3>
        <p className={subCls}>
          Close AI remembers durable facts about you from conversations and uses them in every
          chat.
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-[var(--ink-4)]">Loading…</p>
      ) : facts.length === 0 ? (
        <p className="text-xs text-[var(--ink-4)]">
          Nothing remembered yet — it learns as you chat.
        </p>
      ) : (
        <div className="space-y-2">
          {facts.map((fact, i) => (
            <div
              key={`${i}-${fact}`}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--fill)]"
            >
              <p className="flex-1 min-w-0 text-sm text-[var(--ink-2)] break-words">{fact}</p>
              <button
                onClick={() => removeFact(i)}
                aria-label="Forget this fact"
                title="Forget this fact"
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-[var(--ink-4)] hover:text-red-400 hover:bg-[var(--fill-strong)] transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && facts.length > 0 && (
        <div className="mt-8 pt-5 border-t border-[var(--line)]">
          <button
            onClick={() => setConfirmWipe(true)}
            className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
          >
            Clear all memory
          </button>
          <p className="text-xs text-[var(--ink-4)] mt-1">
            Forgets everything learned so far. This can&apos;t be undone.
          </p>
        </div>
      )}

      {confirmWipe && (
        <ConfirmModal
          title="Clear all memory"
          message="Close AI will forget every remembered fact about you. This can't be undone."
          confirmLabel="Clear memory"
          danger
          onConfirm={() => {
            wipe();
            setConfirmWipe(false);
          }}
          onClose={() => setConfirmWipe(false)}
        />
      )}
    </>
  );
}

// ── Insights ────────────────────────────────────────────────────────────────

type InsightsData = {
  totalChats: number;
  totalMessages: number;
  totalWords: number;
  estTokens: number;
  mostActiveDay: string;
  avgPerChat: number;
  topics: { word: string; count: number }[];
};

const TOPIC_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'for', 'to', 'with',
  'how', 'what', 'why', 'is', 'are', 'new', 'chat',
]);

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** 12400 → "12.4k", 1000 → "1k", 950 → "950". */
function fmtCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

function computeInsights(sessions: ChatSession[]): InsightsData {
  let totalMessages = 0;
  let totalWords = 0;
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  const topicCounts = new Map<string, number>();

  for (const s of sessions) {
    totalMessages += s.messages.length;
    for (const m of s.messages) {
      if (m.content) totalWords += m.content.trim().split(/\s+/).filter(Boolean).length;
      if (m.timestamp) dayCounts[new Date(m.timestamp).getDay()] += 1;
    }
    for (const raw of (s.title || '').toLowerCase().split(/\s+/)) {
      // Strip punctuation but keep non-ASCII letters (e.g. Tamil titles).
      const word = raw.replace(/[^a-z0-9\u0080-\uffff]+/g, '');
      if (word.length < 3 || TOPIC_STOPWORDS.has(word)) continue;
      topicCounts.set(word, (topicCounts.get(word) ?? 0) + 1);
    }
  }

  const maxDay = Math.max(...dayCounts);
  const topics = Array.from(topicCounts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, 8);

  return {
    totalChats: sessions.length,
    totalMessages,
    totalWords,
    estTokens: Math.round(totalWords * 1.3),
    mostActiveDay: maxDay > 0 ? WEEKDAYS[dayCounts.indexOf(maxDay)] : '—',
    avgPerChat: sessions.length ? Math.round((totalMessages / sessions.length) * 10) / 10 : 0,
    topics,
  };
}

/** Client-side usage stats computed from the user's chat history. */
function InsightsPanel() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getChats()
      .then((sessions) => setData(computeInsights(sessions)))
      .catch(() => toast.error('Could not load your chats.'))
      .finally(() => setLoading(false));
  }, []);

  const maxTopic = data && data.topics.length > 0 ? data.topics[0].count : 1;

  return (
    <>
      <div className="mb-5">
        <h3 className={headingCls}>Insights</h3>
        <p className={subCls}>A snapshot of how you use Close AI — computed on your device.</p>
      </div>

      {loading ? (
        <p className="text-xs text-[var(--ink-4)]">Loading…</p>
      ) : !data || data.totalChats === 0 ? (
        <p className="text-xs text-[var(--ink-4)]">
          No conversations yet — your stats will appear once you start chatting.
        </p>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {(
              [
                ['Total chats', fmtCount(data.totalChats)],
                ['Total messages', fmtCount(data.totalMessages)],
                ['Words exchanged', fmtCount(data.totalWords)],
                ['Est. tokens', fmtCount(data.estTokens)],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-[var(--line)] bg-[var(--fill)] p-4"
              >
                <p className="text-xl font-semibold text-[var(--ink)]">{value}</p>
                <p className="text-[11px] text-[var(--ink-3)] mt-1">{label}</p>
              </div>
            ))}
          </div>

          <Row title="Most active day" desc="Weekday when you send the most messages.">
            <span className="text-sm text-[var(--ink-2)] font-medium">{data.mostActiveDay}</span>
          </Row>
          <Row title="Average messages per chat" desc="Across your whole history.">
            <span className="text-sm text-[var(--ink-2)] font-medium">{data.avgPerChat}</span>
          </Row>

          {/* Top topics */}
          {data.topics.length > 0 && (
            <div className="pt-4">
              <p className="text-sm font-medium text-[var(--ink)]">Top topics</p>
              <p className="text-xs text-[var(--ink-3)] mt-0.5 mb-3">
                Most frequent words from your chat titles.
              </p>
              <div className="space-y-2">
                {data.topics.map((t) => (
                  <div key={t.word} className="flex items-center gap-3">
                    <span className="w-24 flex-shrink-0 text-xs text-[var(--ink-2)] truncate text-right">
                      {t.word}
                    </span>
                    <div className="flex-1 h-4 rounded-md bg-[var(--fill)] overflow-hidden">
                      <div
                        className="h-full rounded-md bg-[var(--accent)]/60"
                        style={{ width: `${Math.max((t.count / maxTopic) * 100, 4)}%` }}
                      />
                    </div>
                    <span className="w-6 flex-shrink-0 text-[11px] text-[var(--ink-4)] tabular-nums">
                      {t.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

const navIcon = (key: Tab) => {
  const cls = 'w-4 h-4';
  if (key === 'account')
    return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
    );
  if (key === 'appearance')
    return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="13.5" cy="6.5" r="1.5" /><circle cx="17.5" cy="10.5" r="1.5" /><circle cx="8.5" cy="7.5" r="1.5" /><circle cx="6.5" cy="12.5" r="1.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 2a10 10 0 100 20c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01a1.5 1.5 0 011.13-2.49H16a6 6 0 006-6c0-5.52-4.48-9-10-9z" /></svg>
    );
  if (key === 'chat')
    return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-9 6l3.5-2H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12z" /></svg>
    );
  if (key === 'data')
    return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3" /><path strokeLinecap="round" d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" /></svg>
    );
  if (key === 'api')
    return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4-2a6 6 0 01-7.74 5.74L9 17H7v2H5v2H2v-3l6.26-6.26A6 6 0 1121 7z" /></svg>
    );
  if (key === 'personas')
    return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM6.7 18.6a6 6 0 0110.6 0" /></svg>
    );
  if (key === 'memory')
    return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 5a2 2 0 012-2h8a2 2 0 012 2v16l-6-4-6 4V5z" /></svg>
    );
  if (key === 'insights')
    return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 20v-6M12 20V4M19 20v-10" /></svg>
    );
  if (key === 'about')
    return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8h.01M11 12h1v4h1" /></svg>
    );
  return (
    <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0v4" /></svg>
  );
};

export function SettingsModal({
  onClose,
  onClearChats,
}: {
  onClose: () => void;
  onClearChats: () => void;
}) {
  const { user, updateUser } = useAuth();
  const { enabled } = useFeatures();
  const [tab, setTab] = useState<Tab>('account');
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [avatar, setAvatar] = useState(user?.avatar ?? '');
  const fileRef = useRef<HTMLInputElement>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(
    typeof document !== 'undefined' && document.documentElement.classList.contains('light')
      ? 'light'
      : 'dark'
  );
  const [accent, setAccent] = useState(
    (typeof window !== 'undefined' && localStorage.getItem(ACCENT_KEY)) || 'red'
  );
  const [textSize, setTextSize] = useState(
    (typeof window !== 'undefined' && localStorage.getItem(TEXT_SIZE_KEY)) || 'medium'
  );
  const [voice, setVoice] = useState(
    (typeof window !== 'undefined' && localStorage.getItem(VOICE_KEY)) || ''
  );
  const [testingVoice, setTestingVoice] = useState(false);
  const [font, setFont] = useState(
    (typeof window !== 'undefined' && localStorage.getItem(FONT_KEY)) || 'default'
  );
  const [codeFont, setCodeFont] = useState(
    (typeof window !== 'undefined' && localStorage.getItem(CODE_FONT_KEY)) || 'default'
  );
  const [style, setStyle] = useState(
    (typeof window !== 'undefined' && localStorage.getItem(STYLE_KEY)) || 'default'
  );
  const [customInstr, setCustomInstr] = useState(
    (typeof window !== 'undefined' && localStorage.getItem(CUSTOM_INSTRUCTIONS_KEY)) || ''
  );
  const [instrSaved, setInstrSaved] = useState(false);
  const [density, setDensity] = useState(
    (typeof window !== 'undefined' && localStorage.getItem(DENSITY_KEY)) || 'comfortable'
  );
  const [notify, setNotify] = useState(
    typeof window !== 'undefined' && localStorage.getItem(NOTIF_KEY) === 'on'
  );
  const t = useT();
  const [lang, setLangState] = useState<Lang>('en');
  useEffect(() => setLangState(getLang()), []);

  // If the open tab maps to a feature an admin just disabled, fall back to Account.
  useEffect(() => {
    const map: Partial<Record<Tab, FeatureKey>> = {
      api: 'api_keys',
      personas: 'personas',
      memory: 'memory',
      insights: 'insights',
    };
    if (
      tab === 'chat' &&
      !enabled('response_style') &&
      !enabled('custom_instructions') &&
      !enabled('notifications')
    ) {
      setTab('account');
      return;
    }
    const f = map[tab];
    if (f && !enabled(f)) setTab('account');
  }, [tab, enabled]);
  const pickLang = (l: Lang) => {
    setLang(l);
    setLangState(l);
  };

  const profileChanged =
    name.trim() !== (user?.name ?? '') ||
    phone.trim() !== (user?.phone ?? '') ||
    (avatar ?? '') !== (user?.avatar ?? '');

  const saveProfile = () => {
    if (!name.trim() || !profileChanged) return;
    setSavingProfile(true);
    updateProfile(name.trim(), phone.trim(), avatar)
      .then((u) => {
        updateUser(u);
        setAvatar(u.avatar ?? '');
        toast.success('Profile updated');
      })
      .catch((e) => toast.error(apiError(e, 'Could not update profile.')))
      .finally(() => setSavingProfile(false));
  };

  const onAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file later
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    // Generous cap: we downscale to 256px ourselves, so the raw size barely
    // matters — this only guards against absurd files. (A typical phone photo
    // is 2-12MB and must NOT be rejected here.)
    if (file.size > 40 * 1024 * 1024) {
      toast.error('Image is too large (max 40MB).');
      return;
    }
    try {
      setAvatar(await fileToAvatar(file));
    } catch {
      toast.error("Couldn't read that image — try a JPG, PNG, or WebP.");
    }
  };

  const savePw = () => {
    if (!cur || next.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }
    if (next !== confirmPw) {
      toast.error('New passwords do not match.');
      return;
    }
    if (next === cur) {
      toast.error('New password must be different from your current one.');
      return;
    }
    setSavingPw(true);
    changePassword(cur, next)
      .then(() => {
        toast.success('Password updated');
        setCur('');
        setNext('');
        setConfirmPw('');
      })
      .catch((e) => toast.error(apiError(e, 'Could not change password.')))
      .finally(() => setSavingPw(false));
  };

  const pickAccent = (a: string) => {
    applyAccent(a);
    setAccent(a);
    try {
      localStorage.setItem(ACCENT_KEY, a);
    } catch {
      /* ignore */
    }
  };
  const pickTextSize = (s: string) => {
    applyTextSize(s);
    setTextSize(s);
    try {
      localStorage.setItem(TEXT_SIZE_KEY, s);
    } catch {
      /* ignore */
    }
  };
  const pickVoice = (name: string) => {
    setVoice(name);
    try {
      localStorage.setItem(VOICE_KEY, name);
    } catch {
      /* ignore */
    }
  };
  const testVoice = async () => {
    if (testingVoice) return;
    setTestingVoice(true);
    try {
      // Preview with the SAME backend neural voice the read-aloud button uses,
      // so what you hear here is exactly what you'll get on replies.
      const blob = await ttsSpeak('Hi! This is a preview of the selected voice.', voice || undefined);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch {
      toast.error('Could not preview that voice. Try again.');
    } finally {
      setTestingVoice(false);
    }
  };
  const pickFont = (f: string) => {
    applyFont(f);
    setFont(f);
    try {
      localStorage.setItem(FONT_KEY, f);
    } catch {
      /* ignore */
    }
  };
  const pickCodeFont = (f: string) => {
    applyCodeFont(f);
    setCodeFont(f);
    try {
      localStorage.setItem(CODE_FONT_KEY, f);
    } catch {
      /* ignore */
    }
  };
  const pickDensity = (d: string) => {
    applyDensity(d);
    setDensity(d);
    try {
      localStorage.setItem(DENSITY_KEY, d);
    } catch {
      /* ignore */
    }
  };
  const toggleNotify = async () => {
    if (notify) {
      setNotify(false);
      try {
        localStorage.setItem(NOTIF_KEY, 'off');
      } catch {
        /* ignore */
      }
      return;
    }
    if (typeof Notification === 'undefined') {
      toast.error("This browser doesn't support notifications.");
      return;
    }
    let perm = Notification.permission;
    if (perm === 'default') {
      try {
        perm = await Notification.requestPermission();
      } catch {
        perm = 'denied';
      }
    }
    if (perm !== 'granted') {
      toast.error('Notification permission denied.');
      return;
    }
    setNotify(true);
    try {
      localStorage.setItem(NOTIF_KEY, 'on');
    } catch {
      /* ignore */
    }
    toast.success('Notifications enabled.');
  };

  const exportAllChats = async () => {
    try {
      // Pull the user's current chat blob via the GET /chats endpoint.
      const { getChats } = await import('@/services/api');
      const sessions = await getChats();
      const blob = new Blob([JSON.stringify(sessions, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `close-ai-chats-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${sessions.length} chat${sessions.length === 1 ? '' : 's'}`);
    } catch {
      toast.error('Could not export your chats.');
    }
  };
  const pickStyle = (s: string) => {
    setStyle(s);
    try {
      localStorage.setItem(STYLE_KEY, s);
    } catch {
      /* ignore */
    }
  };
  const saveCustomInstr = () => {
    try {
      localStorage.setItem(CUSTOM_INSTRUCTIONS_KEY, customInstr.trim());
      setInstrSaved(true);
      setTimeout(() => setInstrSaved(false), 1800);
    } catch {
      /* ignore */
    }
  };
  const [confirmClear, setConfirmClear] = useState(false);
  const doClear = () => {
    onClearChats();
    toast.success('All conversations cleared');
    onClose();
  };

  if (typeof document === 'undefined') return null;

  const strength = pwStrength(next);
  const pwMismatch = confirmPw.length > 0 && confirmPw !== next;

  // Tabs that are tied to an admin-toggleable feature; hidden when it's off.
  const FEATURE_FOR_TAB: Partial<Record<Tab, FeatureKey>> = {
    api: 'api_keys',
    personas: 'personas',
    memory: 'memory',
    insights: 'insights',
  };
  const allNav: { key: Tab; label: string }[] = [
    { key: 'account', label: 'Account' },
    { key: 'appearance', label: 'Appearance' },
    { key: 'chat', label: 'Chat' },
    { key: 'data', label: 'Data' },
    { key: 'api', label: 'API Keys' },
    { key: 'personas', label: 'Personas' },
    { key: 'memory', label: 'Memory' },
    { key: 'insights', label: 'Insights' },
    { key: 'security', label: 'Security' },
    { key: 'about', label: 'About' },
  ];
  // The Chat tab holds three toggleable features — hide it only if all are off.
  const chatHasAny =
    enabled('response_style') || enabled('custom_instructions') || enabled('notifications');
  const nav = allNav.filter((n) => {
    if (n.key === 'chat') return chatHasAny;
    const f = FEATURE_FOR_TAB[n.key];
    return !f || enabled(f);
  });

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-modal-in relative w-full max-w-4xl h-[640px] max-h-[92vh] flex flex-col rounded-2xl bg-[var(--elevated)] border border-[var(--line-strong)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line)]">
          <h2 className="text-xl font-display font-medium text-[var(--ink)] tracking-tight">Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          {/* Nav — horizontal scroll strip on mobile, sidebar column on desktop */}
          <nav className="flex md:flex-col md:w-56 flex-shrink-0 border-b md:border-b-0 md:border-r border-[var(--line)] bg-[var(--base)]/40 p-2 md:p-4 gap-1 md:gap-1.5 overflow-x-auto md:overflow-y-auto">
            {nav.map((n) => (
              <button
                key={n.key}
                onClick={() => setTab(n.key)}
                className={`flex items-center gap-2 md:gap-3 flex-shrink-0 md:w-full text-left whitespace-nowrap px-3 md:px-3.5 py-2 md:py-2.5 rounded-xl text-sm transition-colors ${
                  tab === n.key
                    ? 'bg-[var(--fill-strong)] text-[var(--ink)] font-medium'
                    : 'text-[var(--ink-3)] hover:bg-[var(--fill)] hover:text-[var(--ink-2)]'
                }`}
              >
                {navIcon(n.key)}
                {t(n.label)}
              </button>
            ))}
          </nav>

          {/* Right content */}
          <div key={tab} className="animate-fade-in flex-1 min-w-0 overflow-y-auto scroll-smooth px-5 md:px-8 py-6 md:py-7">
            {tab === 'account' && (
              <>
                <div className="mb-5">
                  <h3 className={headingCls}>Account</h3>
                  <p className={subCls}>Manage your profile details.</p>
                </div>
                {/* Profile header card — avatar + photo upload + colour presets */}
                <div className="p-4 mb-6 rounded-2xl border border-[var(--line)] bg-[var(--fill)]">
                  <div className="flex items-center gap-4">
                    <UserAvatar
                      avatar={avatar}
                      name={user?.name}
                      size={72}
                      className="shadow-[0_6px_16px_-6px_color-mix(in_srgb,var(--accent)_45%,transparent)]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-semibold text-[var(--ink)] truncate">{user?.name}</p>
                        {user?.is_admin && (
                          <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent-fg)] bg-[var(--accent)]/12 border border-[var(--accent)]/30 rounded-full px-2 py-0.5">
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--ink-3)] truncate mt-0.5">{user?.email}</p>
                      <div className="flex items-center gap-2 mt-2.5">
                        <button
                          onClick={() => fileRef.current?.click()}
                          className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-[var(--line)] text-[var(--ink-2)] px-3 py-1.5 hover:bg-[var(--fill-strong)] hover:text-[var(--ink)] transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0-12l-4 4m4-4l4 4" />
                          </svg>
                          Upload photo
                        </button>
                        {avatar && (
                          <button
                            onClick={() => setAvatar('')}
                            className="text-xs font-medium text-[var(--ink-4)] hover:text-red-400 px-2 py-1.5 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Superhero avatars */}
                  <div className="mt-4 pt-4 border-t border-[var(--line)]">
                    <p className="text-[11px] text-[var(--ink-4)] mb-2">Or pick a superhero</p>
                    <div className="flex flex-wrap gap-2">
                      {AVATAR_PRESETS.map((p, i) => {
                        const val = `preset:${i}`;
                        const active = avatar === val;
                        return (
                          <button
                            key={i}
                            onClick={() => setAvatar(val)}
                            aria-label={`Superhero avatar ${i + 1}`}
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${
                              active ? 'ring-2 ring-offset-2 ring-offset-[var(--fill)] ring-[var(--ink-2)]' : ''
                            }`}
                            style={{ background: p.bg }}
                          >
                            <span style={{ fontSize: 18, lineHeight: 1 }}>{p.emoji}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onAvatarFile} />
                </div>

                {/* Editable fields */}
                <div className="space-y-4 max-w-sm">
                  <div>
                    <label className={fieldLabel}>Display name</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={fieldLabel}>Phone number</label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Add a phone number"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={fieldLabel}>Email address</label>
                    <div className="relative max-w-sm">
                      <input
                        value={user?.email ?? ''}
                        readOnly
                        disabled
                        className={`${inputCls} pr-10 opacity-70 cursor-not-allowed`}
                      />
                      <svg
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--ink-4)]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <rect x="5" y="11" width="14" height="9" rx="2" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V8a4 4 0 118 0v3" />
                      </svg>
                    </div>
                    <p className="text-[11px] text-[var(--ink-4)] mt-1.5">Used to sign in — can&apos;t be changed.</p>
                  </div>
                </div>

                <div className="flex max-w-sm mt-6">
                  <button onClick={saveProfile} disabled={savingProfile || !name.trim() || !profileChanged} className={btnCls}>
                    {savingProfile ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </>
            )}

            {tab === 'appearance' && (
              <>
                <div className="mb-3">
                  <h3 className={headingCls}>Appearance</h3>
                  <p className={subCls}>Customize how the app looks and feels.</p>
                </div>
                <Row title="Theme" desc="Use a light or dark interface.">
                  <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--base)] p-0.5">
                    {(['light', 'dark'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          setHtmlTheme(t);
                          setTheme(t);
                        }}
                        className={`px-3.5 py-1.5 rounded-md text-sm capitalize transition-colors ${
                          theme === t ? 'bg-[var(--fill-strong)] text-[var(--ink)]' : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row title={t('Language')} desc="Display language for the interface.">
                  <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--base)] p-0.5">
                    {([['en', 'English'], ['ta', 'தமிழ்']] as const).map(([code, label]) => (
                      <button
                        key={code}
                        onClick={() => pickLang(code)}
                        className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                          lang === code
                            ? 'bg-[var(--fill-strong)] text-[var(--ink)]'
                            : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row title="Message text size" desc="Size of the chat conversation text.">
                  <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--base)] p-0.5">
                    {(['small', 'medium', 'large'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => pickTextSize(s)}
                        className={`px-3 py-1.5 rounded-md text-sm capitalize transition-colors ${
                          textSize === s ? 'bg-[var(--fill-strong)] text-[var(--ink)]' : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row title="Density" desc="How tightly the UI is packed.">
                  <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--base)] p-0.5">
                    {(['compact', 'comfortable', 'spacious'] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => pickDensity(d)}
                        className={`px-3 py-1.5 rounded-md text-sm capitalize transition-colors ${
                          density === d ? 'bg-[var(--fill-strong)] text-[var(--ink)]' : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row title="Interface font" desc="Font used across the app.">
                  <select
                    value={font}
                    onChange={(e) => pickFont(e.target.value)}
                    className="bg-[var(--base)] border border-[var(--line)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                  >
                    {FONT_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Row>
                <Row title="Code font" desc="Font for code blocks and snippets.">
                  <select
                    value={codeFont}
                    onChange={(e) => pickCodeFont(e.target.value)}
                    className="bg-[var(--base)] border border-[var(--line)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                  >
                    {CODE_FONT_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Row>
                <div className="py-4">
                  <p className="text-sm font-medium text-[var(--ink)]">Accent color</p>
                  <p className="text-xs text-[var(--ink-3)] mt-0.5 mb-3">Pick the highlight color used across the app.</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(ACCENTS).map(([n, a]) => (
                      <button
                        key={n}
                        onClick={() => pickAccent(n)}
                        title={a.label}
                        aria-label={a.label}
                        className={`w-6 h-6 shrink-0 rounded-full transition-transform hover:scale-110 ${
                          accent === n ? 'ring-2 ring-offset-2 ring-offset-[var(--elevated)] ring-[var(--ink-2)]' : ''
                        }`}
                        style={{ background: a.vars['--accent'] }}
                      />
                    ))}
                  </div>
                </div>
                {enabled('read_aloud') && (
                  <Row title="Read-aloud voice" desc="Neural voice used by the read-aloud (speaker) button on replies.">
                    <div className="flex items-center gap-2">
                      <select
                        value={voice}
                        onChange={(e) => pickVoice(e.target.value)}
                        className="bg-[var(--base)] border border-[var(--line)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)] max-w-[180px]"
                      >
                        {TTS_VOICES.map((v) => (
                          <option key={v.key} value={v.key}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={testVoice}
                        disabled={testingVoice}
                        className="text-xs text-[var(--ink-3)] hover:text-[var(--ink)] border border-[var(--line)] rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50"
                      >
                        {testingVoice ? '…' : 'Test'}
                      </button>
                    </div>
                  </Row>
                )}
              </>
            )}

            {tab === 'chat' && (
              <>
                <div className="mb-3">
                  <h3 className={headingCls}>Chat</h3>
                  <p className={subCls}>Tune how Close AI responds to you.</p>
                </div>
                {enabled('response_style') && (
                <Row title="Response style" desc="Sets the tone and length of answers.">
                  <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--base)] p-0.5">
                    {(['default', 'concise', 'explanatory', 'formal'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => pickStyle(s)}
                        className={`px-3 py-1.5 rounded-md text-xs sm:text-sm capitalize transition-colors ${
                          style === s
                            ? 'bg-[var(--fill-strong)] text-[var(--ink)]'
                            : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </Row>
                )}
                {enabled('custom_instructions') && (
                <div className="py-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-[var(--ink)]">Custom instructions</p>
                    {instrSaved && <span className="text-xs text-[var(--accent-fg)]">Saved ✓</span>}
                  </div>
                  <p className="text-xs text-[var(--ink-3)] mb-2.5">
                    Tell Close AI how to respond — e.g. &ldquo;Always answer in Tanglish&rdquo;, &ldquo;Keep code
                    comments minimal&rdquo;, or &ldquo;I&apos;m a beginner, explain simply&rdquo;.
                  </p>
                  <textarea
                    value={customInstr}
                    onChange={(e) => setCustomInstr(e.target.value)}
                    onBlur={saveCustomInstr}
                    rows={4}
                    maxLength={1200}
                    placeholder="Add custom instructions…"
                    className="w-full bg-[var(--fill)] border border-[var(--line)] rounded-lg px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)] transition-colors resize-none"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-[var(--ink-4)]">{customInstr.length}/1200</span>
                    <button onClick={saveCustomInstr} className={btnCls}>
                      Save
                    </button>
                  </div>
                </div>
                )}
                {enabled('notifications') && (
                <Row
                  title="Notify when a long reply finishes"
                  desc="Browser notification when a streamed answer completes (works when the tab is in the background)."
                >
                  <button
                    onClick={toggleNotify}
                    aria-pressed={notify}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      notify ? 'bg-[var(--accent)]' : 'bg-[var(--fill-strong)]'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        notify ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </Row>
                )}
              </>
            )}

            {tab === 'data' && (
              <>
                <div className="mb-3">
                  <h3 className={headingCls}>Data</h3>
                  <p className={subCls}>Export or wipe what Close AI has stored for your account.</p>
                </div>
                {enabled('data_export') && (
                <Row title="Export all conversations" desc="Download a JSON archive of every chat you have.">
                  <button onClick={exportAllChats} className={btnCls}>
                    Export
                  </button>
                </Row>
                )}
                <Row
                  title="Browser storage"
                  desc="Settings, prompts, folders, and per-chat preferences are stored locally."
                >
                  <button
                    onClick={() => {
                      try {
                        const prefix = 'close_ai_';
                        const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix));
                        keys.forEach((k) => localStorage.removeItem(k));
                        toast.success(`Cleared ${keys.length} local preference${keys.length === 1 ? '' : 's'}.`);
                      } catch {
                        toast.error("Couldn't clear local preferences.");
                      }
                    }}
                    className="text-sm font-medium rounded-lg border border-[var(--line)] text-[var(--ink-2)] px-4 py-2 hover:bg-[var(--fill)] hover:text-[var(--ink)] transition-colors"
                  >
                    Reset local preferences
                  </button>
                </Row>
                <div className="mt-8 pt-5 border-t border-[var(--line)]">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-4)] mb-2">
                    Danger zone
                  </p>
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
                  >
                    Clear all conversations
                  </button>
                  <p className="text-xs text-[var(--ink-4)] mt-1">
                    Permanently removes every chat. This can&apos;t be undone.
                  </p>
                </div>
              </>
            )}

            {tab === 'api' && <ApiKeysPanel />}

            {tab === 'personas' && <PersonasPanel />}

            {tab === 'memory' && <MemoryPanel />}

            {tab === 'insights' && <InsightsPanel />}

            {tab === 'security' && (
              <>
                <div className="mb-5">
                  <h3 className={headingCls}>Security</h3>
                  <p className={subCls}>Change your password. Pick a strong one you don&apos;t use elsewhere.</p>
                </div>

                <div className="space-y-4 max-w-sm">
                  <div>
                    <label className={fieldLabel}>Current password</label>
                    <PasswordField
                      value={cur}
                      onChange={setCur}
                      show={showCur}
                      onToggle={() => setShowCur((v) => !v)}
                      placeholder="Enter current password"
                      autoComplete="current-password"
                    />
                  </div>

                  <div>
                    <label className={fieldLabel}>New password</label>
                    <PasswordField
                      value={next}
                      onChange={setNext}
                      show={showNew}
                      onToggle={() => setShowNew((v) => !v)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                    />
                    {next.length > 0 && (
                      <div className="max-w-sm mt-2">
                        <div className="flex gap-1">
                          {[0, 1, 2, 3].map((i) => (
                            <span
                              key={i}
                              className="h-1 flex-1 rounded-full transition-colors"
                              style={{ background: i <= strength.score ? strength.color : 'var(--fill-strong)' }}
                            />
                          ))}
                        </div>
                        <p className="text-[11px] mt-1" style={{ color: strength.color }}>
                          {strength.label} password
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className={fieldLabel}>Confirm new password</label>
                    <PasswordField
                      value={confirmPw}
                      onChange={setConfirmPw}
                      show={showNew}
                      onToggle={() => setShowNew((v) => !v)}
                      placeholder="Re-enter new password"
                      autoComplete="new-password"
                    />
                    {pwMismatch && (
                      <p className="text-[11px] text-red-400 mt-1.5">Passwords don&apos;t match.</p>
                    )}
                  </div>
                </div>

                <ul className="mt-4 space-y-1.5 max-w-sm">
                  <ReqItem ok={next.length >= 8}>At least 8 characters</ReqItem>
                  <ReqItem ok={next.length > 0 && next !== cur}>Different from your current password</ReqItem>
                  <ReqItem ok={confirmPw.length > 0 && next === confirmPw}>Both new passwords match</ReqItem>
                </ul>

                <div className="flex max-w-sm mt-6">
                  <button
                    onClick={savePw}
                    disabled={savingPw || !cur || next.length < 8 || next !== confirmPw || next === cur}
                    className={btnCls}
                  >
                    {savingPw ? 'Updating…' : 'Update password'}
                  </button>
                </div>
              </>
            )}

            {tab === 'about' && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <Logo size={44} />
                  <div className="min-w-0">
                    <p className="text-base font-display font-medium text-[var(--ink)]">Close AI</p>
                    <p className="text-xs text-[var(--ink-3)] mt-0.5">
                      Document intelligence · v{APP_VERSION}
                    </p>
                  </div>
                </div>
                <Row title="Version" desc="Current build of the app.">
                  <span className="text-sm text-[var(--ink-2)] font-mono">{APP_VERSION}</span>
                </Row>
                <Row title="Model" desc="Powering chat, code, vision, and embeddings.">
                  <span className="text-xs text-[var(--ink-2)]">NVIDIA NIM · Llama-3.3-70B</span>
                </Row>
                <Row title="Powered by" desc="The team behind Close AI.">
                  <span className="text-sm text-[var(--accent-fg)] font-medium">Fluxera</span>
                </Row>
                <Row title="Shortcuts" desc="Press the ? key anywhere to view keyboard shortcuts.">
                  <kbd className="px-2 py-0.5 rounded-md bg-[var(--fill)] border border-[var(--line)] text-[11px] font-medium text-[var(--ink-2)]">
                    ?
                  </kbd>
                </Row>
                <p className="mt-6 text-[11px] text-[var(--ink-4)] leading-relaxed">
                  Close AI may make mistakes — verify important info. Your conversations and
                  uploads are private to your account.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
      {confirmClear && (
        <ConfirmModal
          title="Clear all conversations"
          message="Delete ALL conversations? This permanently removes every chat and can't be undone."
          confirmLabel="Delete all"
          danger
          onConfirm={doClear}
          onClose={() => setConfirmClear(false)}
        />
      )}
    </div>,
    document.body
  );
}
