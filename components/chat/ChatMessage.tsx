'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import type { Components } from 'react-markdown';
import { Logo } from '@/components/layout/Logo';
import type { Message } from '@/types';

/* ─── Markdown renderers — theme-aware, readable prose ────────────────────── */
const mdComponents: Components = {
  p: ({ children }) => <p className="mb-4 last:mb-0 leading-7 text-[var(--ink-2)]">{children}</p>,
  h1: ({ children }) => <h1 className="text-lg font-semibold mb-3 mt-6 first:mt-0 text-[var(--ink)]">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-semibold mb-2.5 mt-5 first:mt-0 text-[var(--ink)]">{children}</h2>,
  h3: ({ children }) => <h3 className="text-[15px] font-semibold mb-2 mt-4 first:mt-0 text-[var(--ink)]">{children}</h3>,
  ul: ({ children }) => <ul className="list-disc list-outside pl-5 mb-4 space-y-1.5 text-[var(--ink-2)] marker:text-[var(--accent-fg)]">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-outside pl-5 mb-4 space-y-1.5 text-[var(--ink-2)] marker:text-[var(--ink-4)]">{children}</ol>,
  li: ({ children }) => <li className="leading-7 pl-0.5">{children}</li>,
  pre: ({ children }) => (
    <pre className="bg-[var(--code)] border border-[var(--line)] rounded-xl p-4 text-[13px] overflow-x-auto mb-4 font-mono leading-relaxed">
      {children}
    </pre>
  ),
  code: ({ children, className }) => {
    const isBlock = Boolean(className);
    if (isBlock) return <code className={`${className ?? ''} text-[var(--ink-2)] text-[13px] font-mono`}>{children}</code>;
    return <code className="px-1.5 py-0.5 bg-[var(--fill)] rounded-md text-[13px] text-[var(--accent-fg)] font-mono">{children}</code>;
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

interface Props {
  message: Message;
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string) => void;
}

export function ChatMessage({ message, onEdit, onDelete }: Props) {
  const isUser = message.role === 'user';

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const el = textareaRef.current;
      el.focus();
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
      el.selectionStart = el.selectionEnd = el.value.length;
    }
  }, [isEditing]);

  const handleCopy = () => navigator.clipboard.writeText(message.content).then(() => toast.success('Copied'));
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
            className="w-full bg-[var(--fill)] text-[var(--ink)] rounded-2xl px-4 py-3 text-[15px] resize-none outline-none border border-violet-400/50 transition-colors leading-7"
            style={{ maxHeight: '240px', overflowY: 'auto' }}
          />
          <div className="flex items-center justify-end gap-2 mt-2">
            <button onClick={handleCancelEdit} className="text-xs text-[var(--ink-3)] hover:text-[var(--ink)] px-3 py-1.5 rounded-lg hover:bg-[var(--fill)] transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={!editValue.trim()}
              className="text-xs text-white bg-gradient-to-r from-[#8b7bff] to-[#6366f1] hover:opacity-90 disabled:opacity-40 px-3.5 py-1.5 rounded-lg transition-opacity font-medium shadow-md shadow-indigo-500/20"
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
        <div className="max-w-[85%] bg-[var(--bubble)] text-[var(--ink)] rounded-2xl rounded-br-md border border-[var(--line)] px-4 py-2.5 text-[15px] leading-7 shadow-sm">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        <div className="flex items-center gap-0.5 mt-1 mr-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
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

  /* ── Assistant message ── */
  return (
    <div className="group animate-msg-in flex gap-3 items-start">
      <AssistantAvatar />
      <div className="flex-1 min-w-0 pt-0.5 text-[15px]">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
          {message.content}
        </ReactMarkdown>

        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {message.sources.map((src, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-3)] bg-[var(--fill)] border border-[var(--line)] rounded-lg px-2.5 py-1">
                <svg className="w-3 h-3 flex-shrink-0 text-[var(--accent-fg)]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                <span>{src.source ?? `Source ${i + 1}`}{src.page != null && `, p.${src.page}`}</span>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-0.5 mt-1.5 -ml-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
          <IconButton onClick={handleCopy} title="Copy">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </IconButton>
        </div>
      </div>
    </div>
  );
}
