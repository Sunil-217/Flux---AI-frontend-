import { NewChatButton } from './NewChatButton';
import { ChatListItem } from './ChatListItem';
import { Logo } from '@/components/layout/Logo';
import type { ChatSession } from '@/types';

interface Props {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
}

export function Sidebar({
  sessions,
  activeSessionId,
  isOpen,
  onClose,
  onNewChat,
  onSelectSession,
  onDeleteSession,
}: Props) {
  return (
    <aside
      className={[
        'flex flex-col bg-[var(--panel)] backdrop-blur-xl border-r border-[var(--line)]',
        'fixed inset-y-0 left-0 z-50',
        'md:relative md:inset-auto md:z-auto',
        'w-72 md:w-[270px] flex-shrink-0 h-full',
        'transition-transform duration-300 ease-out',
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      ].join(' ')}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 h-16 flex-shrink-0">
        <Logo size={34} />
        <div className="flex-1 min-w-0">
          <h1 className="text-[15px] font-semibold text-[var(--ink)] tracking-tight leading-none">Close AI</h1>
          <p className="text-[11px] text-[var(--ink-3)] mt-1 leading-none">Document Intelligence</p>
        </div>
        <button
          onClick={onClose}
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors"
          aria-label="Close sidebar"
        >
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* New chat */}
      <div className="px-3 pb-1">
        <NewChatButton onClick={onNewChat} />
      </div>

      {/* Sessions */}
      <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-4 space-y-1">
        {sessions.length > 0 && (
          <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-4)]">
            Recent
          </p>
        )}
        {sessions.length === 0 ? (
          <div className="mt-12 px-4 text-center">
            <p className="text-sm text-[var(--ink-3)]">No conversations yet</p>
            <p className="text-xs text-[var(--ink-4)] mt-1">Start one above to begin</p>
          </div>
        ) : (
          sessions.map((session) => (
            <ChatListItem
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              onClick={() => onSelectSession(session.id)}
              onDelete={() => onDeleteSession(session.id)}
            />
          ))
        )}
      </nav>
    </aside>
  );
}
