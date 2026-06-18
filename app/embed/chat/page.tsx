'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { businessChat, apiError } from '@/services/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: { filename: string; content: string }[];
}

function EmbedChatInner() {
  const params = useSearchParams();
  const apiKey = params.get('key') ?? '';
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async () => {
    const q = input.trim();
    if (!q || loading || !apiKey) return;
    setInput('');
    setError('');

    const userMsg: Message = { role: 'user', content: q };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const history = messages
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await businessChat(apiKey, q, history);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.answer, sources: res.sources },
      ]);
    } catch (e: unknown) {
      const msg = apiError(e, 'Failed to get a response.');
      setError(msg);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Sorry, something went wrong. Please try again.` },
      ]);
    }
    setLoading(false);
  }, [input, loading, apiKey, messages]);

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (!apiKey) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0b] text-neutral-500 text-sm px-4 text-center">
        No API key provided. Add <code className="text-neutral-400 mx-1">?key=bk_...</code> to the URL.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0b] text-white overflow-hidden" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/8 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-[var(--accent,#7c3aed)]/10 border border-[var(--accent,#7c3aed)]/20 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-[var(--accent,#7c3aed)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-9 6l3.5-2H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12z" />
          </svg>
        </div>
        <span className="text-sm font-medium text-white">Ask us anything</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center pb-8">
            <div className="w-12 h-12 rounded-2xl bg-[var(--accent,#7c3aed)]/8 border border-[var(--accent,#7c3aed)]/15 flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--accent,#7c3aed)]/60" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-9 6l3.5-2H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12z" />
              </svg>
            </div>
            <p className="text-sm text-neutral-500">Hi! Ask me anything about us.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[var(--accent,#7c3aed)] text-white rounded-br-sm'
                  : 'bg-white/6 text-neutral-200 rounded-bl-sm'
              }`}
            >
              <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</p>
              {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/8 space-y-1">
                  {[...new Set(msg.sources.map((s) => s.filename))].map((fname) => (
                    <span
                      key={fname}
                      className="inline-flex items-center gap-1 text-[10px] text-neutral-500 bg-white/4 rounded-md px-1.5 py-0.5 mr-1"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {fname}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/6 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2 border-t border-white/6">
        {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/4 px-3 py-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask a question…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-neutral-600 resize-none outline-none leading-relaxed max-h-28 overflow-y-auto"
            style={{ minHeight: '1.5rem' }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="flex-shrink-0 w-8 h-8 rounded-xl bg-[var(--accent,#7c3aed)] flex items-center justify-center disabled:opacity-30 hover:opacity-90 transition-opacity"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
        <p className="text-center text-[10px] text-neutral-700 mt-2">
          Powered by <span className="text-neutral-500">Close AI · Fluxera</span>
        </p>
      </div>
    </div>
  );
}

export default function EmbedChatPage() {
  return (
    <Suspense>
      <EmbedChatInner />
    </Suspense>
  );
}
