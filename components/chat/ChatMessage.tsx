'use client';

import { useState, useRef, useEffect, memo, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import toast from 'react-hot-toast';
import type { Components } from 'react-markdown';
import { Logo } from '@/components/layout/Logo';
import { OfficeViewer } from './OfficeViewer';
import { ArtifactPreview } from './ArtifactPreview';
import { PyRunner } from './PyRunner';
import { MermaidBlock } from './MermaidBlock';
import { QuizCard } from './QuizCard';
import { translateText, ttsSpeak } from '@/services/api';
import { VOICE_KEY } from '@/components/layout/AccentPicker';
import type { Message, Source } from '@/types';

const LANGS = ['Tamil', 'Hindi', 'Telugu', 'English', 'Spanish', 'French', 'Arabic', 'Chinese'];

/** Recursively pull the raw text out of (possibly syntax-highlighted) nodes. */
function childrenToText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(childrenToText).join('');
  const el = node as { props?: { children?: ReactNode } };
  if (el.props?.children != null) return childrenToText(el.props.children);
  return '';
}

/* Map a code-fence language to a sensible download file extension. */
const CODE_EXT: Record<string, string> = {
  javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts', jsx: 'jsx', tsx: 'tsx',
  python: 'py', py: 'py', java: 'java', c: 'c', cpp: 'cpp', 'c++': 'cpp', csharp: 'cs', cs: 'cs',
  go: 'go', rust: 'rs', rs: 'rs', ruby: 'rb', rb: 'rb', php: 'php', swift: 'swift', kotlin: 'kt',
  html: 'html', css: 'css', scss: 'scss', json: 'json', yaml: 'yml', yml: 'yml', toml: 'toml',
  sql: 'sql', bash: 'sh', sh: 'sh', shell: 'sh', zsh: 'sh', powershell: 'ps1', ps1: 'ps1',
  markdown: 'md', md: 'md', xml: 'xml', text: 'txt', plaintext: 'txt',
};

/* ─── Code block: language label + copy/download buttons + syntax highlighting ─ */
function CodeBlock({ language, children }: { language: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false); // html → ArtifactPreview modal
  const [runSignal, setRunSignal] = useState(0); // python → PyRunner (0 = never run)
  const [pyBusy, setPyBusy] = useState(false);
  const codeText = childrenToText(children).replace(/\n$/, '');
  const langLower = (language || '').toLowerCase();
  const isHtml =
    langLower === 'html' || /^\s*(<!doctype\s+html|<html[\s>])/i.test(codeText);
  const isPython = langLower === 'python' || langLower === 'py';
  const copy = () =>
    navigator.clipboard
      .writeText(codeText)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => toast.error('Could not copy — clipboard blocked.'));
  const download = () => {
    const lang = (language || '').toLowerCase();
    const ext = CODE_EXT[lang] || 'txt';
    const name = lang === 'dockerfile' ? 'Dockerfile' : `snippet.${ext}`;
    const blob = new Blob([codeText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  return (
    <>
    <div className="my-4 rounded-xl border border-[var(--line)] overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-[var(--line)] bg-[var(--fill)]">
        <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-3)]">
          {language || 'code'}
        </span>
        <div className="flex items-center gap-3">
        {isHtml && (
          <button
            onClick={() => setShowPreview(true)}
            title="Render this HTML in a sandboxed preview"
            aria-label="Preview HTML"
            className="inline-flex items-center gap-1 text-[11px] font-medium rounded-md px-2 py-0.5 border border-[var(--line)] bg-[var(--fill)] hover:bg-[var(--fill-hover)] text-[var(--ink-2)] transition-colors"
          >
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z" /></svg>
            Preview
          </button>
        )}
        {isPython && (
          <button
            onClick={() => setRunSignal((s) => s + 1)}
            disabled={pyBusy}
            title="Run this Python code in your browser (Pyodide)"
            aria-label="Run Python code"
            className="inline-flex items-center gap-1 text-[11px] font-medium rounded-md px-2 py-0.5 border border-[var(--line)] bg-[var(--fill)] hover:bg-[var(--fill-hover)] text-[var(--ink-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {!pyBusy && (
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z" /></svg>
            )}
            {pyBusy ? 'Running…' : 'Run'}
          </button>
        )}
        <button
          onClick={download}
          className="flex items-center gap-1 text-[11px] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
          aria-label="Download code"
          title="Download as file"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
          Download
        </button>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-[11px] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              Copied
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              Copy
            </>
          )}
        </button>
        </div>
      </div>
      <pre className="text-[13px] overflow-x-auto font-mono leading-relaxed m-0">
        <code
          className={`hljs language-${language || 'plaintext'}`}
          style={{ fontFamily: 'var(--code-font, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)' }}
        >
          {children}
        </code>
      </pre>
    </div>
    {/* Python output panel — mounts on first Run click, Pyodide loads from CDN then */}
    {runSignal > 0 && (
      <div className="-mt-2 mb-4">
        <PyRunner code={codeText} runSignal={runSignal} onRunningChange={setPyBusy} />
      </div>
    )}
    {/* Live HTML artifact preview (sandboxed iframe modal) */}
    {showPreview && <ArtifactPreview code={codeText} onClose={() => setShowPreview(false)} />}
    </>
  );
}

/* ─── Markdown renderers — theme-aware, readable prose ────────────────────── */
const mdComponents: Components = {
  p: ({ children }) => <p className="mb-4 last:mb-0 leading-7 text-[var(--ink-2)]">{children}</p>,
  h1: ({ children }) => <h1 className="text-lg font-semibold mb-3 mt-6 first:mt-0 text-[var(--ink)]">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-semibold mb-2.5 mt-5 first:mt-0 text-[var(--ink)]">{children}</h2>,
  h3: ({ children }) => <h3 className="text-[length:var(--chat-font-size,15px)] font-semibold mb-2 mt-4 first:mt-0 text-[var(--ink)]">{children}</h3>,
  ul: ({ children }) => <ul className="list-disc list-outside pl-5 mb-4 space-y-1.5 text-[var(--ink-2)] marker:text-[var(--accent-fg)]">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-outside pl-5 mb-4 space-y-1.5 text-[var(--ink-2)] marker:text-[var(--ink-4)]">{children}</ol>,
  li: ({ children }) => <li className="leading-7 pl-0.5">{children}</li>,
  // `pre` is a pass-through; the styled block (with copy button) comes from `code`.
  pre: ({ children }) => <>{children}</>,
  code: ({ children, className }) => {
    const match = /language-(\w+)/.exec(className ?? '');
    const isBlock = Boolean(match) || childrenToText(children).includes('\n');
    if (isBlock) {
      // ```mermaid → replace the code block with the rendered SVG diagram.
      if ((match?.[1] ?? '').toLowerCase() === 'mermaid') {
        return (
          <MermaidBlock
            code={childrenToText(children).replace(/\n$/, '')}
            fallback={<CodeBlock language="mermaid">{children}</CodeBlock>}
          />
        );
      }
      return <CodeBlock language={match?.[1] ?? ''}>{children}</CodeBlock>;
    }
    return <code className="px-1.5 py-0.5 bg-[var(--fill)] rounded-md text-[13px] text-[var(--accent-fg)] font-mono" style={{ fontFamily: 'var(--code-font, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)' }}>{children}</code>;
  },
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[var(--line-strong)] pl-4 text-[var(--ink-3)] italic mb-4">{children}</blockquote>
  ),
  strong: ({ children }) => <strong className="font-semibold text-[var(--ink)]">{children}</strong>,
  em: ({ children }) => <em className="italic text-[var(--ink-2)]">{children}</em>,
  a: ({ href, children }) => (
    <a href={href} className="text-[var(--accent-fg)] hover:underline underline-offset-2 transition-colors" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  hr: () => <hr className="border-[var(--line)] my-5" />,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4 rounded-xl border border-[var(--line)]">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-[var(--line)] px-3 py-2 text-left text-xs font-semibold text-[var(--ink-2)] bg-[var(--fill)]">{children}</th>
  ),
  td: ({ children }) => <td className="border-b border-[var(--line)] px-3 py-2 text-sm text-[var(--ink-3)]">{children}</td>,
  // Inline images (including data: URIs from /image). Styled so they render
  // at a sensible size and look like a real attached asset, not a broken icon.
  // Guard against empty src: React warns and the browser would re-fetch the
  // current page, so drop the element entirely when src is missing/blank.
  img: ({ src, alt }) => {
    const url = typeof src === 'string' ? src.trim() : '';
    if (!url) return null;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={alt || ''}
        loading="lazy"
        className="my-3 max-w-full w-auto h-auto max-h-[520px] rounded-xl border border-[var(--line)] shadow-sm bg-[var(--fill)]"
      />
    );
  },
};

function IconButton({ onClick, title, danger, children }: { onClick: () => void; title: string; danger?: boolean; children: React.ReactNode; }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`p-1.5 rounded-lg text-[var(--ink-4)] transition-colors ${
        danger ? 'hover:text-red-400 hover:bg-red-400/10' : 'hover:text-[var(--ink)] hover:bg-[var(--fill)]'
      }`}
    >
      {children}
    </button>
  );
}

function AssistantAvatar() {
  return <Logo size={28} round animated={false} className="mt-0.5" />;
}

/** Download a data: URI (or any URL) to the user's device. */
function downloadHref(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Friendly label + slug for a generated-media prompt. */
function safeFilename(base: string, ext: string) {
  const clean = (base || 'image').slice(0, 48).replace(/[^a-z0-9-_ ]/gi, '').trim() || 'image';
  return `${clean}.${ext}`;
}

/* Full-screen PDF viewer — Blob URL so iframe renders reliably across browsers. */
function PDFViewer({ src, filename, onClose }: { src: string; filename: string; onClose: () => void }) {
  const [blobUrl, setBlobUrl] = useState('');

  // Convert the stored data URI → Blob URL. Blob URLs work reliably in iframes
  // (data URIs can be blocked by newer browser sandboxing rules).
  useEffect(() => {
    if (!src) return;
    let url = src;
    let revoke = false;
    if (src.startsWith('data:')) {
      try {
        const comma = src.indexOf(',');
        const header = src.slice(0, comma);
        const mime = header.slice(5, header.indexOf(';'));
        const b64 = src.slice(comma + 1);
        const bytes = atob(b64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        url = URL.createObjectURL(new Blob([arr], { type: mime }));
        revoke = true;
      } catch {
        /* fallback: use data URI directly */
      }
    }
    setBlobUrl(url);
    return () => { if (revoke) URL.revokeObjectURL(url); };
  }, [src]);

  // Esc to close.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex flex-col bg-[var(--base)]"
    >
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-[var(--elevated)] border-b border-[var(--line)] flex-shrink-0">
        <div className="w-7 h-8 flex-shrink-0 rounded bg-red-500/15 border border-red-500/30 flex items-center justify-center">
          <span className="text-[9px] font-bold text-red-400 tracking-wide">PDF</span>
        </div>
        <span className="text-sm font-medium text-[var(--ink)] truncate flex-1 min-w-0">{filename}</span>
        <button
          onClick={() => downloadHref(src, filename)}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-3)] hover:text-[var(--ink)] px-2.5 py-1.5 rounded-lg hover:bg-[var(--fill)] border border-[var(--line)] transition-colors flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
          </svg>
          Download
        </button>
        <button
          onClick={onClose}
          title="Close"
          aria-label="Close"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {/* PDF content — relative+absolute so the embed always fills 100% */}
      <div className="flex-1 min-h-0 relative bg-neutral-200 dark:bg-neutral-800">
        {blobUrl ? (
          // <embed type="application/pdf"> triggers Chrome/Edge's built-in PDF
          // viewer reliably. <iframe> sometimes renders blank because the
          // browser's PDF plugin is not invoked for iframe navigation.
          <embed
            src={blobUrl}
            type="application/pdf"
            className="absolute inset-0 w-full h-full"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner />
          </div>
        )}
      </div>
    </div>
  );
}

/* Full-screen image viewer (Claude/ChatGPT-style). Click backdrop or ✕ to close. */
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 sm:p-8 animate-msg-in"
    >
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            downloadHref(src, safeFilename('image', src.startsWith('data:image/png') ? 'png' : 'jpg'));
          }}
          title="Download"
          aria-label="Download image"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
          </svg>
        </button>
        <button
          onClick={onClose}
          title="Close"
          aria-label="Close"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Full size"
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl cursor-default"
      />
    </div>
  );
}

/* Animated placeholder while media is generating (image / pdf / video / excel / word / ppt). */
function GeneratingCard({ kind, prompt }: { kind: 'image' | 'video' | 'pdf' | 'excel' | 'word' | 'ppt'; prompt?: string }) {
  const label =
    kind === 'image' ? 'Creating image' :
    kind === 'video' ? 'Generating video' :
    kind === 'pdf'   ? 'Writing your document' :
    kind === 'excel' ? 'Building spreadsheet' :
    kind === 'word'  ? 'Writing Word document' :
    'Building presentation';
  return (
    <div className="mt-1">
      {kind === 'image' ? (
        <div className="relative w-full max-w-sm aspect-square rounded-xl border border-[var(--line)] overflow-hidden bg-[var(--fill)]">
          <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_30%,var(--fill-hover)_50%,transparent_70%)] bg-[length:200%_100%]" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Spinner />
            <span className="text-xs font-medium text-[var(--ink-3)]">{label}…</span>
          </div>
        </div>
      ) : (
        <div className="inline-flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--fill)] px-4 py-3">
          <Spinner />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--ink-2)]">{label}…</p>
            {prompt && <p className="text-[11px] text-[var(--ink-4)] truncate max-w-[260px]">{prompt}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="w-6 h-6 animate-spin text-[var(--accent-fg)]" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ── File download card (Excel / Word / PPT) ────────────────────────────────
const FILE_META = {
  excel: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', label: 'XLSX' },
  word:  { bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    text: 'text-blue-400',    label: 'DOCX' },
  ppt:   { bg: 'bg-orange-500/10',  border: 'border-orange-500/30',  text: 'text-orange-400',  label: 'PPTX' },
} as const;

function FileCard({
  url,
  name,
  kind,
  onView,
}: {
  url: string;
  name: string;
  kind: 'excel' | 'word' | 'ppt';
  onView: () => void;
}) {
  const m = FILE_META[kind];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onView}
      onKeyDown={(e) => e.key === 'Enter' && onView()}
      className="mt-2 flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--fill)] px-3.5 py-3 max-w-sm cursor-pointer hover:bg-[var(--fill-hover)] hover:border-[var(--line-strong)] transition-colors group/file"
    >
      <div className={`w-10 h-12 flex-shrink-0 rounded-md ${m.bg} border ${m.border} flex items-center justify-center`}>
        <span className={`text-[10px] font-bold tracking-wide ${m.text}`}>{m.label}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--ink)] truncate">{name}</p>
        <p className="text-[11px] text-[var(--ink-4)]">Click to view · or download →</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Eye icon — visual cue that the card opens an in-app preview */}
        <div className="w-8 h-8 flex items-center justify-center text-[var(--ink-3)] group-hover/file:text-[var(--ink)] transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </div>
        {/* Download — separate click area; stops propagation so it doesn't open the viewer */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            downloadHref(url, name);
          }}
          title={`Download ${m.label}`}
          aria-label={`Download ${m.label}`}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] border border-[var(--line)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

interface Props {
  message: Message;
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string) => void;
  onVariant?: (messageId: string, index: number) => void;
  onRegenerateMedia?: (kind: 'image' | 'video' | 'pdf' | 'excel' | 'word' | 'ppt', prompt: string) => void;
  streaming?: boolean;
}

function ChatMessageInner({ message, onEdit, onDelete, onVariant, onRegenerateMedia, streaming }: Props) {
  const isUser = message.role === 'user';

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const [openSource, setOpenSource] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null); // neural-TTS playback element
  const audioUrlRef = useRef<string | null>(null); // object URL backing audioRef (revoked after use)
  const synthRef = useRef(false); // true while the browser speechSynthesis fallback is active
  const ttsReqRef = useRef(0); // bumping this invalidates an in-flight ttsSpeak request
  const [translated, setTranslated] = useState<string | null>(null);
  const [tLang, setTLang] = useState('');
  const [translating, setTranslating] = useState(false);
  const [tMenu, setTMenu] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [pdfViewer, setPdfViewer] = useState(false);
  const [officeView, setOfficeView] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Close the image lightbox on Escape.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightbox]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const el = textareaRef.current;
      el.focus();
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
      el.selectionStart = el.selectionEnd = el.value.length;
    }
  }, [isEditing]);

  const handleCopy = () =>
    navigator.clipboard
      .writeText(message.content)
      .then(() => toast.success('Copied'))
      .catch(() => toast.error('Could not copy — clipboard blocked.'));
  /* ── Read aloud: neural TTS (backend MP3), browser speechSynthesis fallback ── */
  const stopSpeak = () => {
    ttsReqRef.current++; // invalidate any in-flight ttsSpeak request
    audioRef.current?.pause();
    audioRef.current = null;
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    if (synthRef.current && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      synthRef.current = false;
    }
    setSpeaking(false);
    setTtsLoading(false);
  };

  // Stop playback and free the object URL if the message unmounts mid-play.
  useEffect(() => {
    return () => {
      ttsReqRef.current++;
      audioRef.current?.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      if (synthRef.current && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speakWithBrowser = (plain: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(plain);
    try {
      const vn = localStorage.getItem(VOICE_KEY);
      if (vn) {
        const v = window.speechSynthesis.getVoices().find((x) => x.name === vn);
        if (v) u.voice = v;
      }
    } catch {
      /* ignore */
    }
    u.onend = () => { synthRef.current = false; setSpeaking(false); };
    u.onerror = () => { synthRef.current = false; setSpeaking(false); };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    synthRef.current = true;
    setSpeaking(true);
  };

  const speak = async () => {
    // Toggle off: a second click stops playback (or cancels the load).
    if (speaking || ttsLoading) {
      stopSpeak();
      return;
    }
    const plain = message.content
      .replace(/```[\s\S]*?```/g, ' code block ')
      .replace(/[#*`_>~|]/g, '');
    if (!plain.trim()) return;
    // If the user picked a specific device voice in Settings → Appearance, honor
    // it directly. The neural backend TTS has its own fixed voice and would
    // otherwise always win, making the voice selection appear to do nothing.
    // No selection ⇒ use the higher-quality backend voice.
    let chosenVoice = '';
    try {
      chosenVoice = localStorage.getItem(VOICE_KEY) || '';
    } catch {
      /* ignore */
    }
    if (chosenVoice) {
      speakWithBrowser(plain);
      return;
    }
    const req = ++ttsReqRef.current;
    setTtsLoading(true);
    try {
      const blob = await ttsSpeak(plain); // neural MP3 from the backend
      if (req !== ttsReqRef.current) return; // user cancelled while loading
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audioUrlRef.current = url;
      const done = () => {
        if (audioUrlRef.current === url) {
          URL.revokeObjectURL(url);
          audioUrlRef.current = null;
        }
        if (audioRef.current === audio) audioRef.current = null;
        setSpeaking(false);
      };
      audio.onended = done;
      audio.onerror = done;
      await audio.play();
      if (req !== ttsReqRef.current) return; // raced with a stop click
      setSpeaking(true);
    } catch {
      // Backend TTS down/unreachable — fall back to the browser voice.
      if (req === ttsReqRef.current) speakWithBrowser(plain);
    } finally {
      if (req === ttsReqRef.current) setTtsLoading(false);
    }
  };
  const doTranslate = (lang: string) => {
    setTMenu(false);
    setTranslating(true);
    translateText(message.content, lang)
      .then((t) => {
        setTranslated(t);
        setTLang(lang);
      })
      .catch(() => toast.error('Translation failed.'))
      .finally(() => setTranslating(false));
  };
  const handleStartEdit = () => { setEditValue(message.content); setIsEditing(true); };
  const handleSaveEdit = () => {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    if (trimmed !== message.content) onEdit?.(message.id, trimmed);
    setIsEditing(false);
  };
  const handleCancelEdit = () => { setEditValue(message.content); setIsEditing(false); };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
    if (e.key === 'Escape') handleCancelEdit();
  };
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  /* ── User editing ── */
  if (isUser && isEditing) {
    return (
      <div className="animate-msg-in flex flex-col items-end">
        <div className="w-full sm:max-w-[85%]">
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => { setEditValue(e.target.value); autoResize(); }}
            onKeyDown={handleKeyDown}
            rows={1}
            className="w-full bg-[var(--fill)] text-[var(--ink)] rounded-2xl px-4 py-3 text-[length:var(--chat-font-size,15px)] resize-none outline-none border border-red-400/50 transition-colors leading-7"
            style={{ maxHeight: '240px', overflowY: 'auto' }}
          />
          <div className="flex items-center justify-end gap-2 mt-2">
            <button onClick={handleCancelEdit} className="text-xs text-[var(--ink-3)] hover:text-[var(--ink)] px-3 py-1.5 rounded-lg hover:bg-[var(--fill)] transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={!editValue.trim()}
              className="text-xs text-white bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] hover:opacity-90 disabled:opacity-40 px-3.5 py-1.5 rounded-lg transition-opacity font-medium shadow-md shadow-red-500/20"
            >
              Save &amp; send
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── User message ── */
  if (isUser) {
    return (
      <div className="group animate-msg-in flex flex-col items-end">
        {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
        <div className="max-w-[85%] bg-[var(--bubble)] text-[var(--ink)] rounded-2xl rounded-br-md border border-[var(--line)] px-4 py-2.5 text-[length:var(--chat-font-size,15px)] leading-7 shadow-sm">
          {typeof message.image === 'string' && message.image.length > 0 ? (
            <button type="button" onClick={() => setLightbox(message.image!)} className="block cursor-zoom-in" title="Click to view full size">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={message.image}
                alt="attachment"
                className="rounded-lg mb-2 max-h-64 w-auto border border-[var(--line)]"
              />
            </button>
          ) : null}
          {message.content && <p className="whitespace-pre-wrap">{message.content}</p>}
        </div>
        <div className="flex items-center gap-0.5 mt-1 mr-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity duration-150">
          <IconButton onClick={handleCopy} title="Copy">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </IconButton>
          <IconButton onClick={handleStartEdit} title="Edit">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </IconButton>
          <IconButton onClick={() => onDelete?.(message.id)} title="Delete" danger>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </IconButton>
        </div>
      </div>
    );
  }

  // Group sources by file so the same PDF isn't listed multiple times —
  // one chip per file, expanding to show each retrieved passage.
  const sourceGroups: { filename: string; items: Source[] }[] = [];
  (message.sources ?? []).forEach((src, i) => {
    const name = src.metadata?.filename ?? src.source ?? `Source ${i + 1}`;
    const existing = sourceGroups.find((g) => g.filename === name);
    if (existing) existing.items.push(src);
    else sourceGroups.push({ filename: name, items: [src] });
  });

  /* ── Media generation: in-flight loading card ── */
  if (message.error) {
    const failedKind = message.pending ?? 'image';
    const kindLabel =
      failedKind === 'excel' ? 'spreadsheet' :
      failedKind === 'word'  ? 'Word document' :
      failedKind === 'ppt'   ? 'presentation' :
      failedKind;
    return (
      <div className="group animate-msg-in flex gap-3 items-start">
        <AssistantAvatar />
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="inline-flex items-start gap-3 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 max-w-md">
            <svg className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008M10.34 3.94l-7.36 12.74A1.5 1.5 0 004.28 19h15.44a1.5 1.5 0 001.3-2.32L13.66 3.94a1.5 1.5 0 00-2.6 0z" />
            </svg>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--ink)]">
                Couldn&apos;t generate that {kindLabel}
              </p>
              <p className="text-[13px] text-[var(--ink-3)] mt-0.5 break-words">{message.content}</p>
              {message.imagePrompt && onRegenerateMedia && (
                <button
                  onClick={() => onRegenerateMedia(failedKind as 'image' | 'video' | 'pdf' | 'excel' | 'word' | 'ppt', message.imagePrompt!)}
                  className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-fg)] hover:underline"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Try again
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (message.pending) {
    return (
      <div className="animate-msg-in flex gap-3 items-start">
        <AssistantAvatar />
        <div className="flex-1 min-w-0 pt-0.5">
          <GeneratingCard kind={message.pending} prompt={message.imagePrompt} />
        </div>
      </div>
    );
  }

  /* ── Assistant message ── */
  return (
    <div className="group animate-msg-in flex gap-3 items-start">
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
      <AssistantAvatar />
      <div className="flex-1 min-w-0 pt-0.5 text-[length:var(--chat-font-size,15px)]">
        {message.content && (
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeHighlight, rehypeKatex]}
            components={mdComponents}
          >
            {message.content}
          </ReactMarkdown>
        )}
        {streaming && (
          <span className="inline-block w-[3px] h-[1.05em] align-text-bottom bg-[var(--accent-fg)] rounded-[1px] animate-pulse ml-0.5" />
        )}

        {/* Interactive quiz (from /quiz) — renders below the "Quiz ready!" text */}
        {(message.quizData?.length ?? 0) > 0 && <QuizCard questions={message.quizData!} />}

        {/* Generated image (from /image) — card with hover toolbar + click-to-expand */}
        {typeof message.imageUrl === 'string' && message.imageUrl.length > 0 && (
          <div className="mt-2 group/img relative inline-block max-w-full">
            <button
              type="button"
              onClick={() => setLightbox(message.imageUrl!)}
              title="Click to view full size"
              className="block cursor-zoom-in"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={message.imageUrl}
                alt={message.imagePrompt || 'Generated image'}
                loading="lazy"
                className="block max-w-full w-auto h-auto max-h-[520px] rounded-xl border border-[var(--line)] shadow-sm bg-[var(--fill)]"
              />
            </button>
            {/* Hover toolbar: expand + download */}
            <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover/img:opacity-100 transition-opacity">
              <button
                onClick={() => setLightbox(message.imageUrl!)}
                title="View full size"
                aria-label="View full size"
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/55 hover:bg-black/75 text-white backdrop-blur-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
              <button
                onClick={() =>
                  downloadHref(
                    message.imageUrl!,
                    safeFilename(message.imagePrompt || 'image', message.imageUrl!.startsWith('data:image/png') ? 'png' : 'jpg')
                  )
                }
                title="Download"
                aria-label="Download image"
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/55 hover:bg-black/75 text-white backdrop-blur-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                </svg>
              </button>
            </div>
            {/* Caption + regenerate */}
            {(message.imagePrompt || onRegenerateMedia) && (
              <div className="flex items-center gap-2 mt-1.5">
                {message.imagePrompt && (
                  <span className="text-[11px] text-[var(--ink-4)] truncate flex-1">{message.imagePrompt}</span>
                )}
                {onRegenerateMedia && message.imagePrompt && (
                  <button
                    onClick={() => onRegenerateMedia('image', message.imagePrompt!)}
                    title="Generate a different image"
                    className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-3)] hover:text-[var(--ink)] flex-shrink-0"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Regenerate
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Generated PDF (from /pdf) — click card to view inline, download button saves */}
        {typeof message.pdfUrl === 'string' && message.pdfUrl.length > 0 && (
          <>
            {pdfViewer && (
              <PDFViewer
                src={message.pdfUrl}
                filename={message.pdfName || 'document.pdf'}
                onClose={() => setPdfViewer(false)}
              />
            )}
            {/* Card — the whole card opens the viewer; ↓ button downloads */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setPdfViewer(true)}
              onKeyDown={(e) => e.key === 'Enter' && setPdfViewer(true)}
              className="mt-2 flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--fill)] px-3.5 py-3 max-w-sm cursor-pointer hover:bg-[var(--fill-hover)] hover:border-[var(--line-strong)] transition-colors group/pdf"
            >
              <div className="w-10 h-12 flex-shrink-0 rounded-md bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <span className="text-[10px] font-bold text-red-400 tracking-wide">PDF</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--ink)] truncate">{message.pdfName || 'document.pdf'}</p>
                <p className="text-[11px] text-[var(--ink-4)]">Click to view · or download →</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Eye icon — visual cue that the card is viewable */}
                <div className="w-8 h-8 flex items-center justify-center text-[var(--ink-3)] group-hover/pdf:text-[var(--ink)] transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                {/* Download — separate click area, stops propagation so it doesn't open viewer */}
                <button
                  onClick={(e) => { e.stopPropagation(); downloadHref(message.pdfUrl!, message.pdfName || 'document.pdf'); }}
                  title="Download PDF"
                  aria-label="Download PDF"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] border border-[var(--line)] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Generated file card (Excel / Word / PPT) — click to view inline, ↓ downloads */}
        {typeof message.fileUrl === 'string' && message.fileUrl.length > 0 && message.fileKind && (
          <>
            {officeView && (
              <OfficeViewer
                src={message.fileUrl}
                filename={message.fileName || `file.${message.fileKind}`}
                kind={message.fileKind}
                onClose={() => setOfficeView(false)}
              />
            )}
            <FileCard
              url={message.fileUrl}
              name={message.fileName || `file.${message.fileKind}`}
              kind={message.fileKind}
              onView={() => setOfficeView(true)}
            />
          </>
        )}

        {/* Generated-video player (from /video slash command) */}
        {typeof message.videoUrl === 'string' && message.videoUrl.length > 0 && (
          <div className="mt-3 rounded-xl border border-[var(--line)] overflow-hidden bg-black/40">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={message.videoUrl}
              controls
              preload="metadata"
              className="w-full max-w-md block"
            />
            <div className="px-3 py-1.5 text-[11px] text-[var(--ink-4)] flex items-center justify-between gap-3">
              <span>Pollinations.ai · streamed on play</span>
              <a
                href={message.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent-fg)] hover:underline"
              >
                Open in new tab
              </a>
            </div>
          </div>
        )}

        {translating && <p className="text-xs text-[var(--ink-4)] mt-2">Translating…</p>}
        {translated && (
          <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--fill)] p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-4)]">
                Translated · {tLang}
              </span>
              <button
                onClick={() => setTranslated(null)}
                className="text-[11px] text-[var(--ink-3)] hover:text-[var(--ink)]"
              >
                Show original
              </button>
            </div>
            <p className="text-[14px] text-[var(--ink-2)] whitespace-pre-wrap leading-7">{translated}</p>
          </div>
        )}

        {sourceGroups.length > 0 && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-1.5">
              {sourceGroups.map((group, i) => {
                const active = openSource === i;
                return (
                  <button
                    key={group.filename}
                    onClick={() => setOpenSource(active ? null : i)}
                    title="Click to view the source text"
                    className={`inline-flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1 border transition-colors ${
                      active
                        ? 'bg-[var(--fill-hover)] border-[var(--line-strong)] text-[var(--ink)]'
                        : 'text-[var(--ink-3)] bg-[var(--fill)] border-[var(--line)] hover:bg-[var(--fill-hover)] hover:text-[var(--ink-2)]'
                    }`}
                  >
                    <svg className="w-3 h-3 flex-shrink-0 text-[var(--accent-fg)]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    <span className="max-w-[170px] truncate">{group.filename}</span>
                    {group.items.length > 1 && (
                      <span className="text-[var(--ink-4)]">· {group.items.length} passages</span>
                    )}
                    <svg className={`w-3 h-3 flex-shrink-0 transition-transform ${active ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                );
              })}
            </div>
            {openSource !== null && sourceGroups[openSource] && (
              <div className="mt-2 space-y-2">
                {sourceGroups[openSource].items.map((src, k) => (
                  <div
                    key={`${k}-${(src.content || '').slice(0, 32)}`}
                    className="text-[13px] text-[var(--ink-2)] bg-[var(--fill)] border border-[var(--line)] rounded-xl p-3 leading-relaxed max-h-52 overflow-y-auto whitespace-pre-wrap"
                  >
                    {sourceGroups[openSource].items.length > 1 && (
                      <div className="text-[11px] font-medium text-[var(--ink-4)] mb-1.5 uppercase tracking-wide">
                        Passage {k + 1}
                      </div>
                    )}
                    {src.content || 'No preview available for this source.'}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {(message.variants?.length ?? 0) > 1 &&
          (() => {
            const total = message.variants!.length;
            const idx = message.variantIndex ?? total - 1;
            return (
              <div className="flex items-center gap-1 mt-2">
                <button
                  onClick={() => onVariant?.(message.id, idx - 1)}
                  disabled={idx <= 0}
                  aria-label="Previous answer"
                  title="Previous answer"
                  className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--ink-4)] hover:text-[var(--ink)] hover:bg-[var(--fill)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="text-[11px] tabular-nums text-[var(--ink-3)]">
                  {idx + 1} / {total}
                </span>
                <button
                  onClick={() => onVariant?.(message.id, idx + 1)}
                  disabled={idx >= total - 1}
                  aria-label="Next answer"
                  title="Next answer"
                  className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--ink-4)] hover:text-[var(--ink)] hover:bg-[var(--fill)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            );
          })()}

        <div className="flex items-center gap-0.5 mt-1.5 -ml-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity duration-150">
          <IconButton onClick={handleCopy} title="Copy">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </IconButton>
          <IconButton onClick={speak} title={ttsLoading ? 'Cancel' : speaking ? 'Stop' : 'Read aloud'}>
            {ttsLoading ? (
              <svg className="w-3.5 h-3.5 animate-spin text-[var(--accent-fg)]" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-20" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            ) : speaking ? (
              <svg className="w-3.5 h-3.5 text-[var(--accent-fg)]" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H2v6h4l5 4V5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14" /></svg>
            )}
          </IconButton>
          <div className="relative">
            <IconButton onClick={() => setTMenu((o) => !o)} title="Translate">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
            </IconButton>
            {tMenu && (
              <div className="absolute left-0 top-8 z-20 py-1 rounded-lg bg-[var(--elevated)] border border-[var(--line-strong)] shadow-xl min-w-[120px]">
                {LANGS.map((l) => (
                  <button
                    key={l}
                    onClick={() => doTranslate(l)}
                    className="block w-full text-left px-3 py-1.5 text-xs text-[var(--ink-2)] hover:bg-[var(--fill)] hover:text-[var(--ink)]"
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Memoized: during streaming the message list re-renders on every token, but
// only the streaming message's object identity changes — settled messages
// (markdown, highlighting, KaTeX — all expensive) skip re-rendering entirely.
export const ChatMessage = memo(ChatMessageInner);
