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
  getWidgetConfig,
  saveWidgetConfig,
  submitWidgetCss,
  apiError,
  type ApiKeyInfo,
  type KbInfo,
  type KbDocument,
  type PlanTier,
} from '@/services/api';
import {
  WIDGET_THEMES,
  WIDGET_CSS_CLASSES,
  mergeWidgetConfig,
  type WidgetConfig,
} from '@/lib/widgetTheme';

type Sub = 'knowledge' | 'integration' | 'appearance' | 'plans';

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

const FILE_ICON = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const CHAT_ICON = (
  <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-9 6l3.5-2H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12z" />
  </svg>
);

/** Deterministic accent-tinted avatar initials for an app. */
function appGlyph(name: string) {
  const letter = (name.trim()[0] || 'A').toUpperCase();
  return letter;
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-md px-4">
      <div className="animate-modal-in relative w-full max-w-md rounded-3xl border border-[var(--line-strong)] bg-[var(--elevated)] shadow-2xl p-6 space-y-5 overflow-hidden">
        <div className="grain-overlay" />
        {!freshKey ? (
          <>
            <div className="relative flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[var(--accent)]/12 text-[var(--accent-fg)] flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--ink)]">Create a new app</h3>
                <p className="text-xs text-[var(--ink-3)] mt-0.5">Each app has its own key + knowledge base.</p>
              </div>
            </div>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              placeholder="App name (e.g. Acme Support Bot)"
              maxLength={60}
              className="relative w-full rounded-xl border border-[var(--line)] bg-[var(--base)] px-3.5 py-3 text-sm text-[var(--ink)] placeholder:text-[var(--ink-4)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-shadow"
            />
            <div className="relative flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors">
                Cancel
              </button>
              <button
                onClick={create}
                disabled={creating || !name.trim()}
                className="btn-shine px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity shadow-lg shadow-[var(--accent)]/20"
              >
                {creating ? 'Creating…' : 'Create app'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="relative flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/12 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--ink)]">App created</h3>
                <p className="text-xs text-[var(--ink-3)] mt-0.5">Save your secret key — shown only once.</p>
              </div>
            </div>
            <div className="relative rounded-xl border border-amber-500/30 bg-amber-500/8 p-3.5 space-y-2">
              <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider">Secret key · server-side use</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all text-[11px] font-mono text-[var(--ink)] bg-[var(--base)] rounded-lg px-2.5 py-2 border border-[var(--line)] select-all">
                  {freshKey.key}
                </code>
                <button onClick={copy} className="flex-shrink-0 px-3 py-2 rounded-lg bg-[var(--fill-strong)] text-xs text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors">
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-[10px] text-[var(--ink-4)] leading-relaxed">
                For embedding the chat widget you'll use a separate public token — always available under Integration.
              </p>
            </div>
            <div className="relative flex justify-end">
              <button
                onClick={() => onCreated(freshKey.info)}
                className="btn-shine px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[var(--accent)]/20"
              >
                Continue →
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
  const [dragOver, setDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const atLimit = kb.doc_count >= kb.doc_limit;
  const unlimited = kb.doc_limit >= 100000;

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
        break;
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

  const pct = unlimited ? Math.min(100, kb.doc_count * 8) : Math.min(100, Math.round((kb.doc_count / Math.max(1, kb.doc_limit)) * 100));

  return (
    <div className="space-y-5">
      {/* Usage meter */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--fill)] px-4 py-3.5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold text-[var(--ink)] tabular-nums">{kb.doc_count}</span>
            <span className="text-xs text-[var(--ink-4)]">/ {unlimited ? '∞' : kb.doc_limit} documents</span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-fg)] bg-[var(--accent)]/10 rounded-full px-2 py-0.5 capitalize">
            {kb.plan} plan
          </span>
        </div>
        <div className="h-2 rounded-full bg-[var(--fill-strong)] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${atLimit && !unlimited ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 'bg-gradient-to-r from-[var(--grad-from)] to-[var(--grad-to)]'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Upload dropzone */}
      <div
        role="button"
        tabIndex={0}
        className={`rounded-2xl border-2 border-dashed p-9 text-center transition-all ${
          atLimit
            ? 'border-[var(--line)] opacity-60 cursor-not-allowed'
            : dragOver
            ? 'border-[var(--accent)] bg-[var(--accent)]/8 cursor-pointer scale-[1.005]'
            : 'border-[var(--line-strong)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/4 cursor-pointer'
        }`}
        onClick={() => !atLimit && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!atLimit) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!atLimit) upload(e.dataTransfer.files); }}
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
          <div className="space-y-3">
            <div className="w-9 h-9 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin mx-auto" />
            <p className="text-sm text-[var(--ink-3)]">Uploading and indexing…</p>
          </div>
        ) : atLimit ? (
          <p className="text-sm text-[var(--ink-3)]">
            Plan limit reached. Open <span className="text-[var(--accent-fg)] font-medium">Plans</span> to add more documents.
          </p>
        ) : (
          <div className="space-y-2.5">
            <div className="w-12 h-12 rounded-2xl bg-[var(--accent)]/10 text-[var(--accent-fg)] flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[var(--ink-2)]">Drop files or <span className="text-[var(--accent-fg)]">click to upload</span></p>
            <p className="text-[11px] text-[var(--ink-4)]">PDF · Word · Excel · PowerPoint · TXT · MD · CSV — up to 20 MB</p>
          </div>
        )}
      </div>

      {/* Doc list */}
      {kb.documents.length > 0 ? (
        <div className="space-y-2">
          {kb.documents.map((doc) => (
            <div
              key={doc.id}
              className="group flex items-center gap-3 px-3.5 py-3 rounded-xl border border-[var(--line)] bg-[var(--fill)] hover:bg-[var(--fill-hover)] transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-[var(--accent)]/10 text-[var(--accent-fg)] flex items-center justify-center flex-shrink-0">
                {FILE_ICON}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--ink)] truncate">{doc.filename}</p>
                <p className="text-[11px] text-[var(--ink-4)] mt-0.5">{fmtSize(doc.file_size)} · {doc.chunk_count} chunks · {fmtDate(doc.uploaded_at)}</p>
              </div>
              <button
                onClick={() => remove(doc)}
                disabled={deletingId === doc.id}
                className="flex-shrink-0 text-xs text-[var(--ink-4)] hover:text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-40 md:opacity-0 md:group-hover:opacity-100"
              >
                {deletingId === doc.id ? '…' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        !uploading && (
          <p className="text-center text-xs text-[var(--ink-4)] py-2">
            No documents yet — upload your first to power the assistant.
          </p>
        )
      )}
    </div>
  );
}

// ── Integration sub-tab ─────────────────────────────────────────────────────────
function CodeWindow({ code, filename }: { code: string; filename: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--base)] overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-[var(--line)] bg-[var(--fill)]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-2 text-[11px] font-mono text-[var(--ink-4)]">{filename}</span>
        </div>
        <button
          onClick={() => navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
          className="text-[11px] font-medium text-[var(--ink-3)] hover:text-[var(--ink)] px-2 py-0.5 rounded-md hover:bg-[var(--fill-strong)] transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="text-[11px] leading-relaxed font-mono text-[var(--ink-2)] p-3.5 overflow-x-auto whitespace-pre">{code}</pre>
    </div>
  );
}

// Code snippets for calling POST /v1/rag/chat from every common language.
const RAG_LANGS: { id: string; label: string; file: string; build: (b: string, t: string) => string }[] = [
  {
    id: 'curl', label: 'cURL', file: 'request.sh',
    build: (b, t) => `curl -X POST ${b}/v1/rag/chat \\
  -H "Content-Type: application/json" \\
  -H "X-Widget-Token: ${t}" \\
  -d '{"question":"What are your hours?","history":[]}'`,
  },
  {
    id: 'javascript', label: 'JavaScript', file: 'chat.js',
    build: (b, t) => `const res = await fetch("${b}/v1/rag/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Widget-Token": "${t}"
  },
  body: JSON.stringify({ question: "What are your hours?", history: [] })
});
const { answer, sources } = await res.json();
console.log(answer);`,
  },
  {
    id: 'python', label: 'Python', file: 'chat.py',
    build: (b, t) => `import requests

res = requests.post(
    "${b}/v1/rag/chat",
    headers={"X-Widget-Token": "${t}"},
    json={"question": "What are your hours?", "history": []},
)
print(res.json()["answer"])`,
  },
  {
    id: 'php', label: 'PHP', file: 'chat.php',
    build: (b, t) => `<?php
$ch = curl_init("${b}/v1/rag/chat");
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    "Content-Type: application/json",
    "X-Widget-Token: ${t}",
  ],
  CURLOPT_POSTFIELDS => json_encode([
    "question" => "What are your hours?",
    "history" => [],
  ]),
]);
$data = json_decode(curl_exec($ch), true);
echo $data["answer"];`,
  },
  {
    id: 'ruby', label: 'Ruby', file: 'chat.rb',
    build: (b, t) => `require "net/http"
require "json"

uri = URI("${b}/v1/rag/chat")
res = Net::HTTP.post(uri,
  { question: "What are your hours?", history: [] }.to_json,
  "Content-Type" => "application/json",
  "X-Widget-Token" => "${t}")
puts JSON.parse(res.body)["answer"]`,
  },
  {
    id: 'go', label: 'Go', file: 'main.go',
    build: (b, t) => `package main

import (
\t"bytes"
\t"encoding/json"
\t"fmt"
\t"net/http"
)

func main() {
\tbody, _ := json.Marshal(map[string]any{
\t\t"question": "What are your hours?",
\t\t"history":  []any{},
\t})
\treq, _ := http.NewRequest("POST", "${b}/v1/rag/chat", bytes.NewBuffer(body))
\treq.Header.Set("Content-Type", "application/json")
\treq.Header.Set("X-Widget-Token", "${t}")
\tres, _ := http.DefaultClient.Do(req)
\tdefer res.Body.Close()
\tvar out map[string]any
\tjson.NewDecoder(res.Body).Decode(&out)
\tfmt.Println(out["answer"])
}`,
  },
  {
    id: 'java', label: 'Java', file: 'Chat.java',
    build: (b, t) => `var client = java.net.http.HttpClient.newHttpClient();
var req = java.net.http.HttpRequest.newBuilder()
    .uri(java.net.URI.create("${b}/v1/rag/chat"))
    .header("Content-Type", "application/json")
    .header("X-Widget-Token", "${t}")
    .POST(java.net.http.HttpRequest.BodyPublishers.ofString(
        "{\\"question\\":\\"What are your hours?\\",\\"history\\":[]}"))
    .build();
var res = client.send(req, java.net.http.HttpResponse.BodyHandlers.ofString());
System.out.println(res.body());`,
  },
  {
    id: 'csharp', label: 'C#', file: 'Chat.cs',
    build: (b, t) => `using System.Net.Http;
using System.Text;

var client = new HttpClient();
var req = new HttpRequestMessage(HttpMethod.Post, "${b}/v1/rag/chat");
req.Headers.Add("X-Widget-Token", "${t}");
req.Content = new StringContent(
    "{\\"question\\":\\"What are your hours?\\",\\"history\\":[]}",
    Encoding.UTF8, "application/json");
var res = await client.SendAsync(req);
Console.WriteLine(await res.Content.ReadAsStringAsync());`,
  },
];

function MultiLangCode({ apiBase, token }: { apiBase: string; token: string }) {
  const [lang, setLang] = useState('curl');
  const active = RAG_LANGS.find((l) => l.id === lang) || RAG_LANGS[0];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {RAG_LANGS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLang(l.id)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${
              lang === l.id
                ? 'bg-[var(--fill-strong)] text-[var(--ink)]'
                : 'text-[var(--ink-3)] hover:text-[var(--ink-2)] hover:bg-[var(--fill)]'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <CodeWindow filename={active.file} code={active.build(apiBase, token)} />
    </div>
  );
}

function IntegrationTab({ kb }: { kb: KbInfo }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';
  const embedUrl = `${origin}/embed/chat?app=${kb.widget_token}`;
  const scriptCode = `<!-- Paste before </body> on every page -->\n<script\n  src="${origin}/widget.js"\n  data-token="${kb.widget_token}"\n  async\n></script>`;
  const iframeCode = `<iframe\n  src="${embedUrl}"\n  width="400"\n  height="600"\n  frameborder="0"\n  style="border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.3)"\n></iframe>`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-5 min-w-0">
        <div className="rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/6 px-4 py-3">
          <p className="text-xs text-[var(--ink-2)] leading-relaxed">
            Your <strong className="text-[var(--ink)]">widget token</strong> is public and safe to embed — it only answers
            from this app's documents and can't access anything else.
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-[var(--ink)] flex items-center gap-2">
            1 · Add the chat bubble to your site
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--accent-fg)] bg-[var(--accent)]/12 rounded-full px-1.5 py-0.5">Recommended</span>
          </p>
          <p className="text-[11px] text-[var(--ink-4)]">
            One line, anywhere on your site. A floating button appears bottom-right and opens the assistant — like Intercom.
          </p>
          <CodeWindow filename="index.html" code={scriptCode} />
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-[var(--ink)]">2 · Or embed it inline (fixed spot)</p>
          <CodeWindow filename="page.html" code={iframeCode} />
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-[var(--ink)]">3 · Or call the API directly</p>
          <p className="text-[11px] text-[var(--ink-4)]">Pick your language and copy — same request, any stack.</p>
          <MultiLangCode apiBase={apiBase} token={kb.widget_token} />
        </div>
      </div>

      {/* Live preview */}
      <div className="lg:sticky lg:top-0">
        <p className="text-xs font-semibold text-[var(--ink)] mb-2">Live preview</p>
        <div className="rounded-2xl border border-[var(--line-strong)] bg-[var(--base)] p-2 shadow-2xl shadow-black/40">
          <iframe
            key={kb.widget_token}
            src={embedUrl}
            title="Widget preview"
            className="w-full rounded-xl bg-[#0a0a0b]"
            style={{ height: 440, border: 'none' }}
          />
        </div>
        <a
          href={embedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] text-[var(--ink-3)] hover:text-[var(--ink)] mt-2 transition-colors"
        >
          Open full screen
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 4h6m0 0v6m0-6L10 14M6 6H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-1" /></svg>
        </a>
      </div>
    </div>
  );
}

// ── Plans sub-tab ─────────────────────────────────────────────────────────────
function PlansTab({ kb, plans }: { kb: KbInfo; plans: PlanTier[] }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--ink-3)]">
        Your app is on the <strong className="text-[var(--ink)] capitalize">{kb.plan}</strong> plan. Upgrade to grow your
        knowledge base — payments are coming soon.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {plans.map((p) => {
          const current = p.key === kb.plan;
          const popular = p.key === 'pro';
          return (
            <div
              key={p.key}
              className={`relative rounded-2xl border p-4 flex flex-col overflow-hidden ${
                current
                  ? 'border-[var(--accent)]/60 bg-gradient-to-br from-[var(--accent)]/12 to-transparent'
                  : popular
                  ? 'border-[var(--line-strong)] bg-[var(--fill)]'
                  : 'border-[var(--line)] bg-[var(--fill)]'
              }`}
            >
              {popular && !current && (
                <span className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wider text-[var(--accent-fg)] bg-[var(--accent)]/12 rounded-full px-1.5 py-0.5">Popular</span>
              )}
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--ink)]">{p.label}</p>
                {current && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--accent-fg)] bg-[var(--accent)]/15 rounded-full px-1.5 py-0.5">Current</span>
                )}
              </div>
              <p className="text-2xl font-semibold text-[var(--ink)] mt-1.5 tabular-nums">{p.price}</p>
              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-[var(--ink-3)]">
                <svg className="w-3.5 h-3.5 text-[var(--accent-fg)] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span>{p.doc_limit >= 100000 ? 'Unlimited' : p.doc_limit} document{p.doc_limit === 1 ? '' : 's'}</span>
              </div>
              <p className="text-[11px] text-[var(--ink-4)] mt-1 flex-1 leading-relaxed">{p.blurb}</p>
              <button
                disabled={current}
                onClick={() => toast('Payments coming soon 🚀', { icon: '💳' })}
                className={`mt-3.5 w-full py-2 rounded-xl text-xs font-medium transition-opacity ${
                  current
                    ? 'bg-[var(--fill-strong)] text-[var(--ink-4)] cursor-default'
                    : 'btn-shine bg-[var(--accent)] text-white hover:opacity-90'
                }`}
              >
                {current ? 'Current plan' : 'Upgrade'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Appearance sub-tab (widget customization + live preview) ───────────────────
function CssStatusBadge({ status, hasCss }: { status: string; hasCss: boolean }) {
  const map: Record<string, { label: string; cls: string }> = {
    approved: { label: 'Live', cls: 'text-emerald-400 bg-emerald-400/10' },
    pending: { label: 'Pending review', cls: 'text-amber-400 bg-amber-400/10' },
    rejected: { label: 'Rejected', cls: 'text-red-400 bg-red-400/10' },
  };
  const s = map[status];
  if (!s || (status === 'approved' && !hasCss)) return null;
  return <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${s.cls}`}>{s.label}</span>;
}

function AppearanceTab({ kb }: { kb: KbInfo }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const previewUrl = `${origin}/embed/chat?app=${kb.widget_token}&preview=1`;
  const [draft, setDraft] = useState<WidgetConfig | null>(null);
  const [saved, setSaved] = useState<WidgetConfig | null>(null);
  const [busy, setBusy] = useState(false);
  // Custom CSS is review-gated, tracked separately from the instant fields.
  const [css, setCss] = useState('');
  const [cssBaseline, setCssBaseline] = useState('');
  const [cssStatus, setCssStatus] = useState('none');
  const [cssNote, setCssNote] = useState('');
  const [showClasses, setShowClasses] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const applyOwnerCfg = useCallback((c: Awaited<ReturnType<typeof getWidgetConfig>>) => {
    const m = { ...mergeWidgetConfig(c), customCss: '' };
    // Default the header title to the app's own name (still fully editable).
    if (!(c.title || '').trim()) m.title = kb.name;
    setDraft(m);
    setSaved(m);
    const editor = c.customCssPending || c.customCss || '';
    setCss(editor);
    setCssBaseline(editor);
    setCssStatus(c.cssStatus || (c.customCss ? 'approved' : 'none'));
    setCssNote(c.cssNote || '');
  }, [kb.name]);

  useEffect(() => {
    getWidgetConfig(kb.key_id).then(applyOwnerCfg).catch(() => applyOwnerCfg({}));
  }, [kb.key_id, applyOwnerCfg]);

  // Preview reflects the instant fields PLUS the CSS currently in the editor.
  const postDraft = useCallback(() => {
    if (!draft) return;
    iframeRef.current?.contentWindow?.postMessage({ type: 'closeai:preview', config: { ...draft, customCss: css } }, origin || '*');
  }, [draft, css, origin]);

  useEffect(() => { postDraft(); }, [postDraft]);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.origin !== origin) return;
      if (e.data?.type === 'closeai:preview-ready') postDraft();
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [origin, postDraft]);

  if (!draft || !saved) return <p className="text-xs text-[var(--ink-4)]">Loading…</p>;

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const cssDirty = css !== cssBaseline;
  // Heuristic: warn devs who paste JS/JSX/HTML into the CSS-only box. Markers
  // chosen to not false-positive on valid CSS (e.g. var(), @keyframes from{}).
  const cssLooksLikeCode = /=>|<\/[a-zA-Z]|\bfunction\b|\bexport\b|\brequire\s*\(|from\s+["']/.test(css);
  const set = (patch: Partial<WidgetConfig>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const save = async () => {
    setBusy(true);
    try {
      const res = await saveWidgetConfig(kb.key_id, draft);
      const m = { ...mergeWidgetConfig(res), customCss: '' };
      setSaved(m);
      setDraft(m);
      toast.success('Appearance saved — live on your widget.');
    } catch (e) {
      toast.error(apiError(e, 'Could not save appearance.'));
    } finally {
      setBusy(false);
    }
  };

  const submitCss = async () => {
    setBusy(true);
    try {
      const res = await submitWidgetCss(kb.key_id, css);
      const editor = res.customCssPending || res.customCss || '';
      setCss(editor);
      setCssBaseline(editor);
      setCssStatus(res.cssStatus || 'none');
      setCssNote(res.cssNote || '');
      toast.success(css.trim() ? 'Submitted to admin for review.' : 'Custom CSS removed.');
    } catch (e) {
      toast.error(apiError(e, 'Could not submit custom CSS.'));
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full bg-[var(--fill)] border border-[var(--line)] rounded-lg px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)] transition-colors';
  const labelCls = 'text-[11px] font-medium uppercase tracking-wide text-[var(--ink-4)]';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
      {/* Editor */}
      <div className="space-y-5 min-w-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Title (app name)</label>
            <input className={inputCls} value={draft.title} maxLength={60} onChange={(e) => set({ title: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Status text</label>
            <input className={inputCls} value={draft.subtitle} maxLength={40} onChange={(e) => set({ subtitle: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Welcome heading</label>
            <input className={inputCls} value={draft.greeting} maxLength={80} onChange={(e) => set({ greeting: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Welcome subtext</label>
            <input className={inputCls} value={draft.tagline} maxLength={160} onChange={(e) => set({ tagline: e.target.value })} />
          </div>
        </div>

        {/* Logo */}
        <div>
          <label className={labelCls}>Logo (image URL)</label>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="w-9 h-9 rounded-lg border border-[var(--line)] bg-[var(--fill)] flex items-center justify-center overflow-hidden flex-shrink-0">
              {draft.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.logoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <svg className="w-4 h-4 text-[var(--ink-4)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z" /></svg>
              )}
            </div>
            <input
              className={inputCls}
              value={draft.logoUrl}
              maxLength={600}
              placeholder="https://yoursite.com/logo.png"
              onChange={(e) => set({ logoUrl: e.target.value })}
            />
          </div>
          <p className="text-[11px] text-[var(--ink-4)] mt-1">Shown in the widget header. Use an https image URL (square works best). Leave blank for the default icon.</p>
        </div>

        {/* Theme picker */}
        <div>
          <label className={labelCls}>Template / theme</label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {WIDGET_THEMES.map((t) => (
              <button
                key={t.key}
                onClick={() => set({ theme: t.key })}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                  draft.theme === t.key
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--ink)]'
                    : 'border-[var(--line)] text-[var(--ink-3)] hover:text-[var(--ink)]'
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ background: t.swatch }} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Accent */}
        <div>
          <label className={labelCls}>Accent color</label>
          <div className="flex items-center gap-2 mt-1.5">
            <input
              type="color"
              value={draft.accent}
              onChange={(e) => set({ accent: e.target.value })}
              className="w-9 h-9 rounded-lg bg-transparent border border-[var(--line)] cursor-pointer p-0.5"
            />
            <input className={`${inputCls} max-w-[130px] font-mono`} value={draft.accent} onChange={(e) => set({ accent: e.target.value })} />
          </div>
        </div>

        {/* Suggestions */}
        <div>
          <label className={labelCls}>Suggested questions</label>
          <div className="space-y-1.5 mt-1.5">
            {draft.suggestions.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className={inputCls}
                  value={s}
                  maxLength={80}
                  onChange={(e) => set({ suggestions: draft.suggestions.map((x, j) => (j === i ? e.target.value : x)) })}
                />
                <button
                  onClick={() => set({ suggestions: draft.suggestions.filter((_, j) => j !== i) })}
                  className="text-[var(--ink-4)] hover:text-red-400 transition-colors flex-shrink-0"
                  title="Remove"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
            {draft.suggestions.length < 6 && (
              <button onClick={() => set({ suggestions: [...draft.suggestions, ''] })} className="text-xs font-medium text-[var(--accent-fg)] hover:underline">
                + Add question
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            disabled={busy || !dirty}
            onClick={save}
            className="btn-shine px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {dirty ? 'Save changes' : 'Saved'}
          </button>
          {dirty && (
            <button onClick={() => { setDraft(saved); }} className="text-xs text-[var(--ink-4)] hover:text-[var(--ink)] transition-colors">
              Reset
            </button>
          )}
          <span className="text-[11px] text-[var(--ink-4)]">Title, logo, theme, accent &amp; questions apply instantly.</span>
        </div>

        {/* ── Custom CSS (review-gated) ─────────────────────────────── */}
        <div className="rounded-xl border border-[var(--line)] bg-[var(--fill)] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-[var(--ink)]">Custom CSS</h4>
              <CssStatusBadge status={cssStatus} hasCss={!!cssBaseline.trim()} />
            </div>
            <span className="text-[10px] text-[var(--ink-4)] tabular-nums">{css.length}/4000</span>
          </div>
          <p className="text-[11px] text-[var(--ink-3)] leading-relaxed">
            Style the widget with your own code. For everyone&apos;s safety, custom CSS is
            <strong className="text-[var(--ink-2)]"> reviewed by an admin</strong> before it goes live on your site.
          </p>

          {cssStatus === 'pending' && (
            <div className="text-[11px] text-amber-300/90 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
              Submitted for review — your live widget keeps its last approved styles until an admin approves this.
            </div>
          )}
          {cssStatus === 'rejected' && (
            <div className="text-[11px] text-red-300/90 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              <strong>Rejected by admin.</strong> {cssNote ? `Reason: ${cssNote}` : 'Please revise and resubmit.'} Your live widget is unchanged.
            </div>
          )}

          <button onClick={() => setShowClasses((v) => !v)} className="text-[11px] text-[var(--accent-fg)] hover:underline">
            {showClasses ? 'Hide' : 'Show'} the {WIDGET_CSS_CLASSES.length} classes you can target
          </button>
          {showClasses && (
            <div className="flex flex-wrap gap-1">
              {WIDGET_CSS_CLASSES.map((c) => (
                <code key={c.cls} title={c.desc} className="text-[10px] font-mono text-[var(--ink-3)] bg-[var(--fill-strong)] rounded px-1.5 py-0.5">{c.cls}</code>
              ))}
            </div>
          )}

          {cssLooksLikeCode && (
            <div className="text-[11px] text-amber-300/90 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
              ⚠ This looks like JavaScript/HTML, not CSS. This box styles the widget with <strong>CSS only</strong> — e.g.{' '}
              <code className="font-mono">{'.cai-title { color: #fff; }'}</code>. Other code won&apos;t apply and will be rejected in review.
            </div>
          )}

          <textarea
            value={css}
            maxLength={4000}
            onChange={(e) => setCss(e.target.value)}
            rows={9}
            spellCheck={false}
            placeholder={'.cai-title { letter-spacing: .02em; }\n.cai-send { border-radius: 8px; }\n.cai-msg-bot { font-size: 13px; }'}
            className="w-full bg-[var(--base)] border border-[var(--line)] rounded-lg px-3 py-2.5 text-xs font-mono leading-relaxed text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)] resize-y"
          />

          <div className="flex items-center gap-3">
            <button
              disabled={busy || !cssDirty}
              onClick={submitCss}
              className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {css.trim() ? 'Submit for review' : 'Remove custom CSS'}
            </button>
            {cssDirty && (
              <button onClick={() => setCss(cssBaseline)} className="text-xs text-[var(--ink-4)] hover:text-[var(--ink)] transition-colors">
                Revert
              </button>
            )}
            <span className="text-[11px] text-[var(--ink-4)]">Preview below shows your draft — it goes live only after approval.</span>
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div className="lg:sticky lg:top-0">
        <p className="text-xs font-semibold text-[var(--ink)] mb-2">Live preview</p>
        <div className="rounded-2xl border border-[var(--line-strong)] bg-[var(--base)] p-2 shadow-2xl shadow-black/40">
          <iframe
            ref={iframeRef}
            key={kb.widget_token}
            src={previewUrl}
            title="Widget preview"
            onLoad={postDraft}
            className="w-full rounded-xl"
            style={{ height: 460, border: 'none' }}
          />
        </div>
        <p className="text-[11px] text-[var(--ink-4)] mt-2">Reflects your draft. Custom CSS applies to the real widget only after admin approval.</p>
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

  const subTabs: [Sub, string][] = [
    ['knowledge', 'Knowledge base'],
    ['integration', 'Integration'],
    ['appearance', 'Appearance'],
    ['plans', 'Plans'],
  ];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-[var(--base)]" style={{ backgroundImage: 'var(--glow)', backgroundAttachment: 'fixed', backgroundRepeat: 'no-repeat' }}>
      {/* Header */}
      <div className="relative flex items-center justify-between px-5 md:px-7 h-16 flex-shrink-0 border-b border-[var(--line)] bg-[var(--panel)] backdrop-blur-xl overflow-hidden">
        <div className="brand-glyph" style={{ opacity: 0.5 }} />
        <div className="relative flex items-center gap-3 min-w-0">
          <Logo size={30} />
          <div className="min-w-0">
            <h2 className="text-lg font-display font-medium tracking-tight leading-none flex items-center gap-2">
              <span className="text-gradient">Developer Platform</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--accent-fg)] bg-[var(--accent)]/10 rounded-full px-2 py-0.5">
                RAG apps
              </span>
            </h2>
            <p className="text-[11px] text-[var(--ink-4)] mt-1 leading-none">Build an AI assistant for your product</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="relative flex items-center gap-1.5 text-sm font-medium text-[var(--ink-3)] hover:text-[var(--ink)] rounded-lg px-3 py-1.5 hover:bg-[var(--fill)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to app
        </button>
      </div>

      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* App list rail */}
        <nav className="flex flex-col md:w-72 flex-shrink-0 border-b md:border-b-0 md:border-r border-[var(--line)] bg-[var(--panel)]/40 p-3 md:p-4 gap-2 overflow-y-auto">
          <button
            onClick={() => setShowCreate(true)}
            className="btn-shine flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[var(--accent)]/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            New app
          </button>

          {loadingApps ? (
            <p className="text-xs text-[var(--ink-4)] px-2 py-3">Loading…</p>
          ) : apps.length === 0 ? (
            <p className="text-xs text-[var(--ink-4)] px-2 py-3 leading-relaxed">No apps yet. Create one to get an API key and start uploading documents.</p>
          ) : (
            apps.map((app) => {
              const active = selectedId === app.id;
              return (
                <button
                  key={app.id}
                  onClick={() => { setSelectedId(app.id); setSub('knowledge'); }}
                  className={`flex items-center gap-2.5 text-left px-2.5 py-2.5 rounded-xl transition-colors ${
                    active ? 'bg-[var(--fill-strong)]' : 'hover:bg-[var(--fill)]'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-semibold ${
                    active ? 'bg-[var(--accent)]/15 text-[var(--accent-fg)]' : 'bg-[var(--fill-strong)] text-[var(--ink-3)]'
                  }`}>
                    {appGlyph(app.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${active ? 'text-[var(--ink)]' : 'text-[var(--ink-2)]'}`}>{app.name}</p>
                    <p className="text-[10px] font-mono text-[var(--ink-4)] mt-0.5 truncate">{app.prefix} · {app.plan ?? 'free'}</p>
                  </div>
                </button>
              );
            })
          )}
        </nav>

        {/* Main */}
        <div className="flex-1 min-w-0 overflow-y-auto px-5 md:px-8 py-6 md:py-7">
          {!selectedId || !kb ? (
            <div className="relative h-full flex items-center justify-center overflow-hidden">
              <div className="brand-glyph" style={{ opacity: 0.6 }} />
              {loadingKb ? (
                <div className="relative w-7 h-7 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
              ) : (
                <div className="relative text-center max-w-sm space-y-4 animate-card-in">
                  <div className="w-16 h-16 rounded-3xl bg-[var(--accent)]/10 border border-[var(--accent)]/15 flex items-center justify-center mx-auto p-4 text-[var(--accent-fg)]/70">
                    {CHAT_ICON}
                  </div>
                  <h3 className="text-2xl font-display font-medium text-[var(--ink)]">Create your first <span className="text-gradient">AI app</span></h3>
                  <p className="text-sm text-[var(--ink-3)] leading-relaxed">
                    Get an API key, upload your business documents, and embed a smart chat assistant into your product —
                    answering only from <em>your</em> content.
                  </p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="btn-shine px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[var(--accent)]/20"
                  >
                    Create an app
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div key={kb.key_id} className="w-full animate-fade-in">
              {/* App header */}
              <div className="flex items-start justify-between gap-3 mb-6">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-[var(--accent)]/12 text-[var(--accent-fg)] flex items-center justify-center flex-shrink-0 text-lg font-semibold">
                    {appGlyph(kb.name)}
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-xl font-semibold text-[var(--ink)] truncate">{kb.name}</h1>
                    <p className="text-xs text-[var(--ink-4)] mt-0.5">
                      {kb.doc_count} document{kb.doc_count === 1 ? '' : 's'} · <span className="capitalize">{kb.plan}</span> plan
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRevoke(apps.find((a) => a.id === kb.key_id)!)}
                  className="flex-shrink-0 text-xs text-[var(--ink-4)] hover:text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                  Delete app
                </button>
              </div>

              {/* Segmented sub-tabs */}
              <div className="inline-flex items-center gap-1 mb-6 p-1 rounded-xl bg-[var(--fill)] border border-[var(--line)]">
                {subTabs.map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setSub(k)}
                    className={`px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      sub === k
                        ? 'bg-[var(--elevated)] text-[var(--ink)] shadow-sm'
                        : 'text-[var(--ink-3)] hover:text-[var(--ink-2)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div key={sub} className="animate-fade-in">
                {sub === 'knowledge' && <KnowledgeTab kb={kb} onChange={() => loadKb(kb.key_id)} />}
                {sub === 'integration' && <IntegrationTab kb={kb} />}
                {sub === 'appearance' && <AppearanceTab kb={kb} />}
                {sub === 'plans' && <PlansTab kb={kb} plans={plans} />}
              </div>
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
