import { NewChatButton } from './NewChatButton';
import { ChatListItem } from './ChatListItem';
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
        // Layout & colour
        'flex flex-col bg-zinc-900 border-r border-zinc-800',
        // Mobile: fixed full-height overlay; Desktop: sits in the flex row
        'fixed inset-y-0 left-0 z-50',
        'md:relative md:inset-auto md:z-auto',
        // Width
        'w-72 md:w-64 flex-shrink-0 h-full',
        // Slide in/out on mobile; always visible on desktop
        'transition-transform duration-200 ease-in-out',
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      ].join(' ')}
    >
      {/* Brand + mobile close button */}
      <div className="flex items-center gap-2.5 px-4 py-[14px] border-b border-zinc-800">
        <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center flex-shrink-0">
          <svg
            className="w-3.5 h-3.5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <span className="text-sm font-semibold text-zinc-100 tracking-tight flex-1">
          Flux AI
        </span>
        {/* Only shown on mobile */}
        <button
          onClick={onClose}
          className="md:hidden w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          aria-label="Close sidebar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* New Chat */}
      <div className="p-3 border-b border-zinc-800/50">
        <NewChatButton onClick={onNewChat} />
      </div>

      {/* Session list */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {sessions.length === 0 ? (
          <p className="text-xs text-zinc-600 text-center mt-8 px-4 leading-relaxed">
            No chats yet.
            <br />
            Click &ldquo;New Chat&rdquo; to start.
          </p>
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

      {/* Footer */}
      <div className="p-4 border-t border-zinc-800">
        <p className="text-[11px] text-zinc-600 text-center">
          RAG-powered document Q&A
        </p>
      </div>
    </aside>
  );
}
