import type { ChatSession } from '@/types';

interface Props {
  session: ChatSession;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}

export function ChatListItem({ session, isActive, onClick, onDelete }: Props) {
  return (
    <div
      className={`group relative flex items-center rounded-xl text-sm transition-colors ${
        isActive
          ? 'bg-[var(--fill-strong)] border border-[var(--line)]'
          : 'border border-transparent hover:bg-[var(--fill)]'
      }`}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-gradient-to-b from-violet-400 to-indigo-500" />
      )}

      <button
        onClick={onClick}
        className={`flex-1 min-w-0 text-left pl-3.5 pr-2 py-2.5 ${
          isActive ? 'text-[var(--ink)]' : 'text-[var(--ink-3)] group-hover:text-[var(--ink-2)]'
        }`}
      >
        <p className="truncate leading-snug font-medium">{session.title}</p>
        {session.uploadedFile && (
          <p className="flex items-center gap-1 mt-0.5 text-[11px] text-[var(--ink-4)] truncate">
            <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <span className="truncate">{session.uploadedFile}</span>
          </p>
        )}
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="Delete chat"
        className="flex-shrink-0 mr-1.5 p-1.5 rounded-lg text-[var(--ink-4)] hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}
