'use client';

import { useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  businessGetMe,
  businessUploadDocument,
  businessDeleteDocument,
  apiError,
  type BusinessMe,
  type BusinessDocumentRow,
} from '@/services/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseUTC(iso: string | null): Date | null {
  if (!iso) return null;
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso);
  const d = new Date(hasTz ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(iso: string | null): string {
  const d = parseUTC(iso);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Login screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (key: string, me: BusinessMe) => void }) {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const k = key.trim();
    if (!k) return;
    setLoading(true);
    try {
      const me = await businessGetMe(k);
      onLogin(k, me);
    } catch (e: unknown) {
      toast.error(apiError(e, 'Invalid or revoked business key.'));
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent,#7c3aed)]/10 border border-[var(--accent,#7c3aed)]/20 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-[var(--accent,#7c3aed)]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white">Business Portal</h1>
          <p className="text-sm text-neutral-500">Enter your API key to manage your knowledge base</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="bk_xxxxxxxxxxxxxxxx"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-white placeholder:text-neutral-600 font-mono focus:outline-none focus:ring-1 focus:ring-[var(--accent,#7c3aed)] focus:border-[var(--accent,#7c3aed)]"
          />
          <button
            type="submit"
            disabled={loading || !key.trim()}
            className="w-full rounded-xl bg-[var(--accent,#7c3aed)] text-white py-2.5 text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {loading ? 'Verifying…' : 'Access Portal'}
          </button>
        </form>

        <p className="text-center text-xs text-neutral-600">
          Powered by{' '}
          <span className="text-neutral-400 font-medium">Close AI · Fluxera</span>
        </p>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ apiKey, initialMe }: { apiKey: string; initialMe: BusinessMe }) {
  const [me, setMe] = useState<BusinessMe>(initialMe);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const frontendUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const embedCode = `<iframe\n  src="${frontendUrl}/embed/chat?key=${apiKey}"\n  width="400"\n  height="600"\n  frameborder="0"\n  style="border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.3);"\n></iframe>`;

  const refresh = useCallback(async () => {
    try { setMe(await businessGetMe(apiKey)); } catch {}
  }, [apiKey]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      try {
        await businessUploadDocument(apiKey, file);
        ok++;
      } catch (e: unknown) {
        toast.error(`${file.name}: ${apiError(e, 'Upload failed.')}`);
      }
    }
    if (ok > 0) toast.success(`${ok} document${ok > 1 ? 's' : ''} uploaded and indexed.`);
    await refresh();
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleDelete(doc: BusinessDocumentRow) {
    if (!confirm(`Delete "${doc.filename}"? This cannot be undone.`)) return;
    setDeletingId(doc.id);
    try {
      await businessDeleteDocument(apiKey, doc.id);
      toast.success('Document deleted.');
      await refresh();
    } catch (e: unknown) {
      toast.error(apiError(e, 'Delete failed.'));
    }
    setDeletingId(null);
  }

  function copyEmbed() {
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Header */}
      <header className="border-b border-white/8 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[var(--accent,#7c3aed)]/10 border border-[var(--accent,#7c3aed)]/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-[var(--accent,#7c3aed)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-none">{me.business_name}</h1>
            <p className="text-[11px] text-neutral-500 mt-0.5">Business Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-neutral-500">
          <span>{me.doc_count} doc{me.doc_count === 1 ? '' : 's'}</span>
          <span>{me.chat_count} chat{me.chat_count === 1 ? '' : 's'}</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Upload area */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-white">Knowledge base</h2>
          <div
            className="rounded-2xl border-2 border-dashed border-white/10 bg-white/2 p-8 text-center cursor-pointer hover:border-[var(--accent,#7c3aed)]/40 hover:bg-[var(--accent,#7c3aed)]/4 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleUpload(e.dataTransfer.files); }}
          >
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.pptx,.txt,.md,.csv,.json"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            {uploading ? (
              <div className="space-y-2">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--accent,#7c3aed)] border-t-transparent animate-spin mx-auto" />
                <p className="text-sm text-neutral-400">Uploading and indexing…</p>
              </div>
            ) : (
              <div className="space-y-2">
                <svg className="w-8 h-8 text-neutral-600 mx-auto" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm text-neutral-400">Drop files here or <span className="text-[var(--accent,#7c3aed)]">click to upload</span></p>
                <p className="text-xs text-neutral-600">PDF, Word, Excel, PowerPoint, TXT, Markdown, CSV · Max 20 MB each</p>
              </div>
            )}
          </div>
        </section>

        {/* Document list */}
        {me.documents.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-white">Uploaded documents</h2>
            <div className="rounded-2xl border border-white/8 overflow-hidden divide-y divide-white/6">
              {me.documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                  <svg className="w-4 h-4 text-neutral-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{doc.filename}</p>
                    <p className="text-xs text-neutral-600">{fmt(doc.file_size)} · {doc.chunk_count} chunks · {fmtDate(doc.uploaded_at)}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                    className="flex-shrink-0 text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-40"
                  >
                    {deletingId === doc.id ? '…' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Embed code */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white">Embed on your website</h2>
            <button
              onClick={copyEmbed}
              className="text-xs text-[var(--accent,#7c3aed)] hover:opacity-80 transition-opacity"
            >
              {copiedEmbed ? 'Copied!' : 'Copy code'}
            </button>
          </div>
          <pre className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-xs text-neutral-400 font-mono overflow-x-auto whitespace-pre">
            {embedCode}
          </pre>
          <p className="text-xs text-neutral-600">
            Paste this snippet anywhere in your HTML. The chat widget will appear as an iframe and answer questions from your uploaded documents.
          </p>
          <a
            href={`/embed/chat?key=${apiKey}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--accent,#7c3aed)] hover:opacity-80 transition-opacity"
          >
            Preview widget
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </a>
        </section>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PortalPage() {
  const [session, setSession] = useState<{ key: string; me: BusinessMe } | null>(null);

  if (!session) {
    return <LoginScreen onLogin={(key, me) => setSession({ key, me })} />;
  }

  return <Dashboard apiKey={session.key} initialMe={session.me} />;
}
