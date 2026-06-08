'use client';

import { useT } from '@/lib/i18n';

interface Props {
  onClick: () => void;
}

export function NewChatButton({ onClick }: Props) {
  const t = useT();
  return (
    <button
      onClick={onClick}
      className="group w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-[var(--ink)] bg-[var(--fill)] border border-[var(--line)] hover:bg-[var(--fill-hover)] hover:border-[var(--line-strong)] active:scale-[0.99] transition-all"
    >
      <span className="flex items-center justify-center w-5 h-5 rounded-md bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] shadow shadow-red-500/30">
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
        </svg>
      </span>
      {t('New chat')}
    </button>
  );
}
