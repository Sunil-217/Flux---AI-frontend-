'use client';

import { Logo } from '@/components/layout/Logo';
import { useT } from '@/lib/i18n';

interface Props {
  hasSession: boolean;
  uploadedFile: string | null;
  onNewChat: () => void;
}

export function EmptyState({ hasSession, uploadedFile, onNewChat }: Props) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center select-none">
      <div className="mb-7">
        <Logo size={68} />
      </div>

      {!hasSession ? (
        <>
          <h2 className="text-3xl sm:text-4xl font-display font-medium mb-3 tracking-tight text-gradient">
            Welcome to Close AI
          </h2>
          <p className="text-sm text-[var(--ink-3)] mb-8 max-w-md leading-relaxed">
            An intelligent assistant with conversation memory, live web search, and
            PDF document understanding — all in one place.
          </p>
          <button
            onClick={onNewChat}
            className="px-6 py-3 bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] hover:shadow-[0_0_30px_-4px_rgba(239,68,68,0.6)] text-sm font-semibold text-white rounded-xl transition-shadow active:scale-[0.98] shadow-lg shadow-red-500/25"
          >
            Start a new chat
          </button>
        </>
      ) : (
        <>
          <h2 className="text-3xl sm:text-4xl font-display font-medium mb-3 tracking-tight text-gradient">
            {t('How can I help you today?')}
          </h2>
          <p className="text-sm text-[var(--ink-3)] max-w-md leading-relaxed">
            {uploadedFile ? (
              <>
                <span className="text-[var(--accent-fg)] font-medium">{uploadedFile}</span> is
                ready. Ask anything about it in the box below.
              </>
            ) : (
              <>
                I remember our conversation and can search the web for current
                info. Ask me anything in the box below.
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}
