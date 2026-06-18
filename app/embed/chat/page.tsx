'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ragChat, apiError } from '@/services/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: { filename: string; content: string }[];
}

const SUGGESTIONS = ['What do you offer?', 'How can I contact you?', 'What are your hours?'];

function EmbedChatInner() {
  const params = useSearchParams();
  // `app` is the public widget token (wk_...). `key` kept as a fallback alias.
  const widgetToken = params.get('app') ?? params.get('key') ?? '';
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || loading || !widgetToken) return;
      setInput('');
      setError('');
      setMessages((prev) => [...prev, { role: 'user', content: q }]);
      setLoading(true);

      const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
      try {
        const res = await ragChat(widgetToken, q, history);
        setMessages((prev) => [...prev, { role: 'assistant', content: res.answer, sources: res.sources }]);
      } catch (e: unknown) {
        setError(apiError(e, 'Failed to get a response.'));
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
      }
      setLoading(false);
    },
    [loading, widgetToken, messages]
  );

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ask(input);
    }
  }

  if (!widgetToken) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0b] text-neutral-500 text-sm px-4 text-center">
        No app token provided. Add <code className="text-neutral-400 mx-1">?app=wk_...</code> to the URL.
      </div>
    );
  }

  const empty = messages.length === 0;

  return (
    <div
      className="flex flex-col h-screen text-white overflow-hidden"
      style={{
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
        background: 'radial-gradient(120% 80% at 50% -10%, rgba(248,113,113,0.10), transparent 60%), #0a0a0b',
      }}
    >
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/8 flex items-center gap-2.5 backdrop-blur-sm">
        <div className="relative w-8 h-8 rounded-xl bg-[#f87171]/12 border border-[#f87171]/25 flex items-center justify-center">
          <svg className="w-4 h-4 text-[#f87171]" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-9 6l3.5-2H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-none">Ask us anything</p>
          <p className="text-[11px] text-emerald-400/90 leading-none mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Online
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 scroll-smooth">
        {empty && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center pb-6">
            <div className="w-14 h-14 rounded-2xl bg-[#f87171]/8 border border-[#f87171]/15 flex items-center justify-center">
              <svg className="w-7 h-7 text-[#f87171]/70" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-9 6l3.5-2H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-200">Hi there 👋</p>
              <p className="text-xs text-neutral-500 mt-1">Ask me anything — I'll answer from our docs.</p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-[240px]">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="text-left text-xs text-neutral-300 bg-white/4 hover:bg-white/8 border border-white/8 rounded-xl px-3 py-2 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-msg-in`}>
            <div
              className={`max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-[#f87171] text-white rounded-2xl rounded-br-md'
                  : 'bg-white/[0.07] text-neutral-200 rounded-2xl rounded-bl-md border border-white/5'
              }`}
            >
              <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</p>
              {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/8 flex flex-wrap gap-1">
                  {[...new Set(msg.sources.map((s) => s.filename).filter(Boolean))].map((fname) => (
                    <span key={fname} className="inline-flex items-center gap-1 text-[10px] text-neutral-400 bg-white/5 rounded-md px-1.5 py-0.5">
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
          <div className="flex justify-start animate-msg-in">
            <div className="bg-white/[0.07] border border-white/5 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2">
        {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 focus-within:border-[#f87171]/40 transition-colors">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoGrow(e.target); }}
            onKeyDown={handleKey}
            placeholder="Ask a question…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-neutral-600 resize-none outline-none leading-relaxed max-h-28 overflow-y-auto"
            style={{ minHeight: '1.5rem' }}
          />
          <button
            onClick={() => ask(input)}
            disabled={loading || !input.trim()}
            aria-label="Send"
            className="flex-shrink-0 w-8 h-8 rounded-xl bg-[#f87171] flex items-center justify-center disabled:opacity-30 hover:opacity-90 transition-opacity"
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
