'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import { Logo } from '@/components/layout/Logo';
import { getSharedChat, type SharedChat } from '@/services/api';

export default function SharePage() {
  const params = useParams();
  const id = (params?.id as string) ?? '';
  const [chat, setChat] = useState<SharedChat | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getSharedChat(id)
      .then(setChat)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="min-h-screen flex flex-col text-[var(--ink)]">
      <header className="flex items-center gap-3 px-4 sm:px-6 h-16 flex-shrink-0 border-b border-[var(--line)] bg-[var(--panel)] backdrop-blur-md">
        <Logo size={30} />
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-[var(--ink)] truncate tracking-tight">
            {chat?.title ?? 'Shared chat'}
          </h1>
          <p className="text-[11px] text-[var(--ink-4)] leading-none mt-0.5">Shared from Close AI · read-only</p>
        </div>
        <Link href="/" className="text-xs font-medium text-[var(--accent-fg)] hover:underline flex-shrink-0">
          Open Close AI →
        </Link>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 space-y-7">
          {loading ? (
            <p className="text-sm text-[var(--ink-3)]">Loading…</p>
          ) : error || !chat ? (
            <div className="text-center mt-16">
              <p className="text-sm text-[var(--ink-2)]">This shared chat wasn&apos;t found or has been removed.</p>
              <Link href="/" className="inline-block mt-3 text-sm text-[var(--accent-fg)] hover:underline">
                Go to Close AI
              </Link>
            </div>
          ) : (
            chat.messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={`u-${i}-${(m.content || '').slice(0, 24)}`} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl bg-[var(--fill-strong)] border border-[var(--line)] px-4 py-2.5 text-[15px] text-[var(--ink)] whitespace-pre-wrap leading-7">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={`a-${i}-${(m.content || '').slice(0, 24)}`} className="flex gap-3 items-start">
                  <Logo size={28} round animated={false} />
                  <div className="flex-1 min-w-0 pt-0.5 text-[15px] leading-7 text-[var(--ink-2)] [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_strong]:text-[var(--ink)] [&_strong]:font-semibold [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-[var(--ink)] [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-[var(--ink)] [&_h2]:mt-5 [&_pre]:bg-[var(--fill)] [&_pre]:border [&_pre]:border-[var(--line)] [&_pre]:rounded-xl [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:my-4 [&_code]:text-[13px] [&_a]:text-[var(--accent-fg)] [&_a]:underline">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeHighlight, rehypeKatex]}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>
                </div>
              )
            )
          )}
        </div>
      </main>
    </div>
  );
}
