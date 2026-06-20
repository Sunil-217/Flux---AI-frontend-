'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ragChat, apiError, getPublicWidgetConfig } from '@/services/api';
import {
  DEFAULT_WIDGET_CONFIG,
  mergeWidgetConfig,
  widgetThemeVars,
  widgetBackground,
  type WidgetConfig,
} from '@/lib/widgetTheme';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: { filename: string; content: string }[];
}

// Static styling hooks that are awkward to set inline (placeholder, focus, hover,
// scrollbar). Uses the same CSS variables as the theme so it stays in sync.
const BASE_CSS = `
.cai-scroll::-webkit-scrollbar{width:6px}
.cai-scroll::-webkit-scrollbar-thumb{background:var(--w-border);border-radius:3px}
.cai-input::placeholder{color:var(--w-text-muted);opacity:.65}
.cai-input-bar:focus-within{border-color:color-mix(in srgb, var(--w-accent) 45%, var(--w-border))}
.cai-suggestion:hover{background:color-mix(in srgb, var(--w-accent) 12%, var(--w-surface))}
.cai-send:hover{opacity:.9}
`;

const ChatGlyph = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-9 6l3.5-2H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12z" />
  </svg>
);

function EmbedChatInner() {
  const params = useSearchParams();
  // `app` is the public widget token (wk_...). `key` kept as a fallback alias.
  const widgetToken = params.get('app') ?? params.get('key') ?? '';
  const [cfg, setCfg] = useState<WidgetConfig>(DEFAULT_WIDGET_CONFIG);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load the saved appearance for this app.
  useEffect(() => {
    if (!widgetToken) return;
    getPublicWidgetConfig(widgetToken)
      .then((c) => setCfg(mergeWidgetConfig(c)))
      .catch(() => {});
  }, [widgetToken]);

  // Live preview: the Developer Console (same origin) posts draft config as the
  // owner edits. Ignored in production (no parent posts).
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data && e.data.type === 'closeai:preview' && e.data.config) {
        setCfg(mergeWidgetConfig(e.data.config));
      }
    }
    window.addEventListener('message', onMsg);
    // Tell the parent we're ready to receive config.
    try {
      window.parent?.postMessage({ type: 'closeai:preview-ready' }, window.location.origin);
    } catch {
      /* no parent */
    }
    return () => window.removeEventListener('message', onMsg);
  }, []);

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
  const accentTint = (pct: number) => `color-mix(in srgb, var(--w-accent) ${pct}%, transparent)`;

  return (
    <div
      className="cai-widget flex flex-col h-screen overflow-hidden"
      style={{
        ...widgetThemeVars(cfg),
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
        background: widgetBackground(cfg),
        color: 'var(--w-text)',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `${BASE_CSS}\n${cfg.customCss || ''}` }} />

      {/* Header */}
      <div
        className="cai-header flex-shrink-0 px-4 py-3 flex items-center gap-2.5 backdrop-blur-sm"
        style={{ borderBottom: '1px solid var(--w-border)' }}
      >
        {cfg.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cfg.logoUrl} alt="" className="cai-logo w-8 h-8 rounded-xl object-cover flex-shrink-0" style={{ border: `1px solid ${accentTint(25)}` }} />
        ) : (
          <div
            className="cai-logo relative w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: accentTint(12), border: `1px solid ${accentTint(25)}`, color: 'var(--w-accent)' }}
          >
            <ChatGlyph className="w-4 h-4" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="cai-title text-sm font-semibold leading-none truncate" style={{ color: 'var(--w-text)' }}>
            {cfg.title}
          </p>
          <p className="text-[11px] text-emerald-400/90 leading-none mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            {cfg.subtitle}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="cai-scroll flex-1 overflow-y-auto px-4 py-4 space-y-3.5 scroll-smooth">
        {empty && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center pb-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: accentTint(8), border: `1px solid ${accentTint(15)}`, color: 'var(--w-accent)' }}
            >
              <ChatGlyph className="w-7 h-7" />
            </div>
            <div>
              <p className="cai-greeting text-sm font-medium" style={{ color: 'var(--w-text)' }}>{cfg.greeting}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--w-text-muted)' }}>{cfg.tagline}</p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-[240px]">
              {cfg.suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="cai-suggestion text-left text-xs rounded-xl px-3 py-2 transition-colors"
                  style={{ color: 'var(--w-text)', background: 'var(--w-surface)', border: '1px solid var(--w-border)' }}
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
              className={`${msg.role === 'user' ? 'cai-msg-user' : 'cai-msg-bot'} max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed shadow-sm`}
              style={
                msg.role === 'user'
                  ? { background: 'var(--w-accent)', color: '#fff', borderRadius: '16px 16px 4px 16px' }
                  : { background: 'var(--w-surface-2)', color: 'var(--w-text)', border: '1px solid var(--w-border)', borderRadius: '16px 16px 16px 4px' }
              }
            >
              <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</p>
              {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 flex flex-wrap gap-1" style={{ borderTop: '1px solid var(--w-border)' }}>
                  {[...new Set(msg.sources.map((s) => s.filename).filter(Boolean))].map((fname) => (
                    <span
                      key={fname}
                      className="inline-flex items-center gap-1 text-[10px] rounded-md px-1.5 py-0.5"
                      style={{ color: 'var(--w-text-muted)', background: 'var(--w-surface)' }}
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
          <div className="flex justify-start animate-msg-in">
            <div className="cai-msg-bot px-4 py-3" style={{ background: 'var(--w-surface-2)', border: '1px solid var(--w-border)', borderRadius: '16px 16px 16px 4px' }}>
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--w-text-muted)', animationDelay: `${i * 0.15}s` }} />
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
        <div
          className="cai-input-bar flex items-end gap-2 rounded-2xl px-3 py-2 transition-colors"
          style={{ border: '1px solid var(--w-border)', background: 'var(--w-input-bg)' }}
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoGrow(e.target); }}
            onKeyDown={handleKey}
            placeholder="Ask a question…"
            className="cai-input flex-1 bg-transparent text-sm resize-none outline-none leading-relaxed max-h-28 overflow-y-auto"
            style={{ minHeight: '1.5rem', color: 'var(--w-text)' }}
          />
          <button
            onClick={() => ask(input)}
            disabled={loading || !input.trim()}
            aria-label="Send"
            className="cai-send flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center disabled:opacity-30 transition-opacity"
            style={{ background: 'var(--w-accent)' }}
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
        {/* Mandatory branding — always shown. */}
        <p className="cai-footer text-center text-[10px] mt-2" style={{ color: 'var(--w-text-muted)', opacity: 0.7 }}>
          Powered by <span style={{ color: 'var(--w-text-muted)' }}>Close AI · Fluxera</span>
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
