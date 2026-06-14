'use client';

import { useEffect, useState } from 'react';
import { getBroadcast, type Broadcast } from '@/services/api';

// Per-user dismissal: we store the id of the dismissed broadcast. A brand-new
// broadcast (different id) re-appears even if the previous one was dismissed.
const DISMISS_KEY = 'close_ai_broadcast_dismissed';

const STYLES: Record<Broadcast['level'], { bar: string; chip: string; icon: React.ReactNode }> = {
  info: {
    bar: 'border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--ink)]',
    chip: 'text-[var(--accent-fg)]',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
  },
  warning: {
    bar: 'border-amber-400/40 bg-amber-400/10 text-[var(--ink)]',
    chip: 'text-amber-400',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    ),
  },
  success: {
    bar: 'border-emerald-400/40 bg-emerald-400/10 text-[var(--ink)]',
    chip: 'text-emerald-400',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
  },
};

export function BroadcastBanner() {
  const [bc, setBc] = useState<Broadcast | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBroadcast()
      .then((b) => {
        if (cancelled || !b) return;
        let dismissed = '';
        try {
          dismissed = localStorage.getItem(DISMISS_KEY) ?? '';
        } catch {
          /* ignore */
        }
        if (String(b.id) !== dismissed) setBc(b);
      })
      .catch(() => {
        /* best-effort — no banner if the fetch fails */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!bc) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(bc.id));
    } catch {
      /* ignore */
    }
    setBc(null);
  };

  const style = STYLES[bc.level] ?? STYLES.info;

  return (
    <div
      role="status"
      className={`flex-shrink-0 flex items-center gap-2.5 px-3 sm:px-4 py-2 border-b ${style.bar}`}
    >
      <svg className={`w-4 h-4 flex-shrink-0 ${style.chip}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        {style.icon}
      </svg>
      <p className="flex-1 min-w-0 text-[13px] leading-snug break-words">{bc.message}</p>
      <button
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
