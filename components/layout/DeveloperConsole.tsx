'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { Logo } from '@/components/layout/Logo';
import {
  listApiKeys,
  createApiKey,
  revokeApiKey,
  getKb,
  getPlans,
  uploadKbDocument,
  deleteKbDocument,
  apiError,
  type ApiKeyInfo,
  type KbInfo,
  type KbDocument,
  type PlanTier,
} from '@/services/api';

type Sub = 'knowledge' | 'integration' | 'plans';

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseUTC(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso);
  const d = new Date(hasTz ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function fmtDate(iso: string | null | undefined): string {
  const d = parseUTC(iso);
  return d ? d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

// ── Create-app modal (shows the secret key ONCE) ────────────────────────────────
function CreateAppModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (info: ApiKeyInfo) => void;
}) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [freshKey, setFreshKey] = useState<{ key: string; info: ApiKeyInfo } | null>(null);
  const [copied, setCopied] = useState(false);

  async function create() {
    const n = name.trim();
    if (!n) return;
    setCreating(true);
    try {
      const res = await createApiKey(n);
      setFreshKey(res);
    } catch (e) {
      toast.error(apiError(e, 'Failed to create app.'));
    }
    setCreating(false);
  }

  function copy() {
    if (!freshKey) return;
    navigator.clipboard.writeText(freshKey.key).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl p-6 space-y-4 animate-card-in">
        {!freshKey ? (
          <>
            <div>
              <h3 className="text-base font-semibold text-[var(--ink)]">Create a new app</h3>
              <p className="text-xs text-[var(--ink-3)] mt-1">
                Each app has its own API key and isolated knowledge base.
              </p>
            </div>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              placeholder="App name (e.g. Acme Support Bot)"
              maxLength={60}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--base)] px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-4)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors">
                Cancel
              </button>
              <button
                onClick={create}
                disabled={creating || !name.trim()}
                className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {creating ? 'Creating…' : 'Create app'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <h3 className="text-base font-semibold text-[var(--ink)]">App created 🎉</h3>
              <p className="text-xs text-[var(--ink-3)] mt-1">
                Your <strong className="text-[var(--ink)]">secret key</strong> is shown once. Use it for server-side
                API calls. (Your embeddable widget uses a separate public token — always available in Integration.)
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-3.5 space-y-2">
              <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-wide">Copy now — never shown again</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all text-[11px] font-mono text-[var(--ink)] bg-[var(--base)] rounded-lg px-2.5 py-2 border border-[var(--line)] select-all">
                  {freshKey.key}
                </code>
                <button onClick={copy} className="flex-shrink-0 px-3 py-2 rounded-lg bg-[var(--fill-strong)] text-xs text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors">
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => onCreated(freshKey.info)}
                className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Continue to app
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

// ── Knowledge base sub-tab ──────────────────────────────────────────────────────
function KnowledgeTab({ kb, onChange }: { kb: KbInfo; onChange: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const atLimit = kb.doc_count >= kb.doc_limit;

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (atLimit) {
      toast.error(`Plan limit reached (${kb.doc_limit}). Upgrade to add more.`);
      return;
    }
    setUploading(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      try {
        await uploadKbDocument(kb.key_id, file);
        ok++;
      } catch (e) {
        toast.error(`${file.name}: ${apiError(e, 'Upload failed.')}`);
        break; // likely hit the plan limit — stop
      }
    }
    if (ok > 0) toast.success(`${ok} document${ok > 1 ? 's' : ''} indexed.`);
    if (fileRef.current) fileRef.current.value = '';
    setUploading(false);
    onChange();
  }

  async function remove(doc: KbDocument) {
    if (!confirm(`Delete "${doc.filename}"?`)) return;
    setDeletingId(doc.id);
    try {
      await deleteKbDocument(kb.key_id, doc.id);
      toast.success('Document deleted.');
      onChange();
    } catch (e) {
      toast.error(apiError(e, 'Delete failed.'));
    }
    setDeletingId(null);
  }

  const pct = Math.min(100, Math.round((kb.doc_count / Math.max(1, kb.doc_limit)) * 100));

  return (
    <div className="space-y-5">
      {/* Usage bar */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--fill)] px-4 py-3">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-[var(--ink-2)] font-medium">
            {kb.doc_count} / {kb.doc_limit === 100000 ? '∞' : kb.doc_limit} documents
          </span>
          <span className="text-[var(--ink-4)] capitalize">{kb.plan} plan</span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--fill-strong)] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${atLimit ? 'bg-amber-500' : 'bg-[var(--accent)]'}`}
            style={{ width: `${kb.doc_limit === 100000 ? Math.min(100, kb.doc_count) : pct}%` }}
          />
        </div>
      </div>

      {/* Upload */}
      <div
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          atLimit
            ? 'border-[var(--line)] opacity-60 cursor-not-allowed'
            : 'border-[var(--line)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/4 cursor-pointer'
        }`}
        onClick={() => !atLimit && fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (!atLimit) upload(e.dataTransfer.files); }}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.pptx,.txt,.md,.csv,.json"
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
        {uploading ? (
          <div className="space-y-2">
            <div className="w-7 h-7 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin mx-auto" />
            <p className="text-sm text-[var(--ink-3)]">Uploading and indexing…</p>
          </div>
        ) : atLimit ? (
          <p className="text-sm text-[var(--ink-3)]">
            Plan limit reached. <span className="text-[var(--accent-fg)]">Upgrade</span> to add more documents.
          </p>
        ) : (
          <div className="space-y-1.5">
            <svg className="w-7 h-7 text-[var(--ink-4)] mx-auto" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-sm text-[var(--ink-2)]">Drop files or <span className="text-[var(--accent-fg)]">click to upload</span></p>
            <p className="text-[11px] text-[var(--ink-4)]">PDF, Word, Excel, PowerPoint, TXT, MD, CSV · Max 20 MB</p>
          </div>
        )}
      </div>

      {/* Doc list */}
      {kb.documents.length > 0 && (
        <div className="rounded-2xl border border-[var(--line)] overflow-hidden divide-y divide-[var(--line)]">
          {kb.documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 px-4 py-3 bg-[var(--fill)]">
              <svg className="w-4 h-4 text-[var(--ink-4)] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--ink)] truncate">{doc.filename}</p>
                <p className="text-[11px] text-[var(--ink-4)]">{fmtSize(doc.file_size)} · {doc.chunk_count} chunks · {fmtDate(doc.uploaded_at)}</p>
              </div>
              <button
                onClick={() => remove(doc)}
                disabled={deletingId === doc.id}
                className="flex-shrink-0 text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-40"
              >
                {deletingId === doc.id ? '…' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Integration sub-tab ─────────────────────────────────────────────────────────
function CopyBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[var(--ink-2)]">{label}</p>
        <button
          onClick={() => navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
          className="text-[11px] text-[var(--accent-fg)] hover:opacity-80 transition-opacity"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="text-[11px] font-mono text-[var(--ink-2)] bg-[var(--base)] border border-[var(--line)] rounded-xl p-3 overflow-x-auto whitespace-pre">
        {code}
      </pre>
    </div>
  );
}

function IntegrationTab({ kb }: { kb: KbInfo }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';
  const embedUrl = `${origin}/embed/chat?app=${kb.widget_token}`;
  const iframeCode = `<iframe\n  src="${embedUrl}"\n  width="400"\n  height="600"\n  frameborder="0"\n  style="border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.3)"\n></iframe>`;
  const jsCode = `const res = await fetch("${apiBase}/v1/rag/chat", {\n  method: "POST",\n  headers: {\n    "Content-Type": "application/json",\n    "X-Widget-Token": "${kb.widget_token}"\n  },\n  body: JSON.stringify({ question: "What are your hours?", history: [] })\n});\nconst { answer, sources } = await res.json();`;
  const curlCode = `curl -X POST ${apiBase}/v1/rag/chat \\\n  -H "Content-Type: application/json" \\\n  -H "X-Widget-Token: ${kb.widget_token}" \\\n  -d '{"question":"What are your hours?","history":[]}'`;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/5 px-4 py-3">
        <p className="text-xs text-[var(--ink-2)]">
          The <strong className="text-[var(--ink)]">widget token</strong> below is public and safe to embed — it can
          only answer questions from this app's documents. Drop the iframe into any page and your users get an instant
          AI assistant.
        </p>
      </div>

      <CopyBlock label="1 — Embed the chat widget (HTML)" code={iframeCode} />

      <a
        href={embedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--accent-fg)] hover:opacity-80 transition-opacity"
      >
        Preview widget
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
      </a>

      <CopyBlock label="2 — Or call the API directly (JavaScript)" code={jsCode} />
      <CopyBlock label="Or with curl" code={curlCode} />
    </div>
  );
}

// ── Plans sub-tab ─────────────────────────────────────────────────────────────
function PlansTab({ kb, plans }: { kb: KbInfo; plans: PlanTier[] }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--ink-3)]">
        Your app is on the <strong className="text-[var(--ink)] capitalize">{kb.plan}</strong> plan. Upgrade to grow your
        knowledge base. (Payments are coming soon.)
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {plans.map((p) => {
          const current = p.key === kb.plan;
          return (
            <div
              key={p.key}
              className={`rounded-2xl border p-4 flex flex-col ${
                current ? 'border-[var(--accent)]/50 bg-[var(--accent)]/8' : 'border-[var(--line)] bg-[var(--fill)]'
              }`}
            >
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold text-[var(--ink)]">{p.label}</p>
                {current && (
                  <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--accent-fg)] bg-[var(--accent)]/15 rounded-full px-1.5 py-0.5">Current</span>
                )}
              </div>
              <p className="text-lg font-semibold text-[var(--ink)] mt-1">{p.price}</p>
              <p className="text-[11px] text-[var(--ink-4)] mt-1.5 flex-1">{p.blurb}</p>
              <button
                disabled={current}
                onClick={() => toast('Payments coming soon 🚀', { icon: '💳' })}
                className={`mt-3 w-full py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  current
                    ? 'bg-[var(--fill-strong)] text-[var(--ink-4)] cursor-default'
                    : 'bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90'
                }`}
              >
                {current ? 'Active' : 'Upgrade'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Console shell ───────────────────────────────────────────────────────────────
export function DeveloperConsole({ onClose }: { onClose: () => void }) {
  const [apps, setApps] = useState<ApiKeyInfo[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [kb, setKb] = useState<KbInfo | null>(null);
  const [loadingKb, setLoadingKb] = useState(false);
  const [sub, setSub] = useState<Sub>('knowledge');
  const [plans, setPlans] = useState<PlanTier[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  const loadApps = useCallback(async () => {
    setLoadingApps(true);
    try {
      const ks = (await listApiKeys()).filter((k) => !k.revoked);
      setApps(ks);
      setSelectedId((prev) => prev ?? (ks.length > 0 ? ks[0].id : null));
    } catch {
      toast.error('Failed to load your apps.');
    }
    setLoadingApps(false);
  }, []);

  const loadKb = useCallback(async (id: number) => {
    setLoadingKb(true);
    try {
      setKb(await getKb(id));
    } catch (e) {
      toast.error(apiError(e, 'Failed to load knowledge base.'));
    }
    setLoadingKb(false);
  }, []);

  useEffect(() => { loadApps(); getPlans().then(setPlans).catch(() => {}); }, [loadApps]);
  useEffect(() => { if (selectedId != null) loadKb(selectedId); }, [selectedId, loadKb]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleRevoke(app: ApiKeyInfo) {
    if (!confirm(`Delete app "${app.name}"? Its API key and knowledge base will stop working.`)) return;
    try {
      await revokeApiKey(app.id);
      toast.success('App deleted.');
      if (selectedId === app.id) { setSelectedId(null); setKb(null); }
      await loadApps();
    } catch (e) {
      toast.error(apiError(e, 'Failed to delete app.'));
    }
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-[var(--base)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 md:px-7 h-16 flex-shrink-0 border-b border-[var(--line)] bg-[var(--panel)]">
        <div className="flex items-center gap-3 min-w-0">
          <Logo size={30} />
          <div className="min-w-0">
            <h2 className="text-lg font-display font-medium text-[var(--ink)] tracking-tight leading-none flex items-center gap-2">
              Developer Platform
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--accent-fg)] bg-[var(--accent)]/10 rounded-full px-2 py-0.5">
                RAG apps
              </span>
            </h2>
            <p className="text-[11px] text-[var(--ink-4)] mt-1 leading-none">Build an AI assistant for your product</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm font-medium text-[var(--ink-3)] hover:text-[var(--ink)] rounded-lg px-3 py-1.5 hover:bg-[var(--fill)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to app
        </button>
      </div>

      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* App list rail */}
        <nav className="flex flex-col md:w-64 flex-shrink-0 border-b md:border-b-0 md:border-r border-[var(--line)] bg-[var(--panel)]/40 p-3 md:p-4 gap-2 overflow-y-auto">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            New app
          </button>

          {loadingApps ? (
            <p className="text-xs text-[var(--ink-4)] px-2 py-3">Loading…</p>
          ) : apps.length === 0 ? (
            <p className="text-xs text-[var(--ink-4)] px-2 py-3 leading-relaxed">No apps yet. Create one to get an API key and start uploading documents.</p>
          ) : (
            apps.map((app) => (
              <button
                key={app.id}
                onClick={() => { setSelectedId(app.id); setSub('knowledge'); }}
                className={`text-left px-3 py-2.5 rounded-xl transition-colors ${
                  selectedId === app.id
                    ? 'bg-[var(--fill-strong)] text-[var(--ink)]'
                    : 'text-[var(--ink-3)] hover:bg-[var(--fill)] hover:text-[var(--ink-2)]'
                }`}
              >
                <p className="text-sm font-medium truncate">{app.name}</p>
                <p className="text-[10px] font-mono text-[var(--ink-4)] mt-0.5">{app.prefix} · {app.plan ?? 'free'}</p>
              </button>
            ))
          )}
        </nav>

        {/* Main */}
        <div className="flex-1 min-w-0 overflow-y-auto px-5 md:px-8 py-6 md:py-7">
          {!selectedId || !kb ? (
            <div className="h-full flex items-center justify-center">
              {loadingKb ? (
                <p className="text-sm text-[var(--ink-4)]">Loading…</p>
              ) : (
                <div className="text-center max-w-sm space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--accent)]/8 border border-[var(--accent)]/15 flex items-center justify-center mx-auto">
                    <svg className="w-7 h-7 text-[var(--accent-fg)]/60" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-9 6l3.5-2H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-[var(--ink)]">Create your first AI app</h3>
                  <p className="text-sm text-[var(--ink-3)]">
                    Get an API key, upload your business documents, and embed a smart chat assistant into your product —
                    powered by Close AI.
                  </p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Create an app
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-3xl">
              {/* App header */}
              <div className="flex items-start justify-between gap-3 mb-5">
                <div className="min-w-0">
                  <h1 className="text-xl font-semibold text-[var(--ink)] truncate">{kb.name}</h1>
                  <p className="text-xs text-[var(--ink-4)] mt-1">
                    {kb.doc_count} document{kb.doc_count === 1 ? '' : 's'} · <span className="capitalize">{kb.plan}</span> plan
                  </p>
                </div>
                <button
                  onClick={() => handleRevoke(apps.find((a) => a.id === kb.key_id)!)}
                  className="flex-shrink-0 text-xs text-red-400 hover:text-red-300 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                  Delete app
                </button>
              </div>

              {/* Sub-tabs */}
              <div className="flex gap-1 mb-6 border-b border-[var(--line)]">
                {([
                  ['knowledge', 'Knowledge base'],
                  ['integration', 'Integration'],
                  ['plans', 'Plans'],
                ] as [Sub, string][]).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setSub(k)}
                    className={`px-3.5 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
                      sub === k
                        ? 'border-[var(--accent)] text-[var(--ink)]'
                        : 'border-transparent text-[var(--ink-3)] hover:text-[var(--ink-2)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {sub === 'knowledge' && <KnowledgeTab kb={kb} onChange={() => loadKb(kb.key_id)} />}
              {sub === 'integration' && <IntegrationTab kb={kb} />}
              {sub === 'plans' && <PlansTab kb={kb} plans={plans} />}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateAppModal
          onClose={() => setShowCreate(false)}
          onCreated={async (info) => {
            setShowCreate(false);
            await loadApps();
            setSelectedId(info.id);
            setSub('knowledge');
          }}
        />
      )}
    </div>,
    document.body
  );
}
