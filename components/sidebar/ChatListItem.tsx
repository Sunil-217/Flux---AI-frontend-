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
      className={`group relative flex items-center rounded-lg text-sm transition-colors ${
        isActive ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
      }`}
    >
      {/* Select button — takes all available space */}
      <button
        onClick={onClick}
        className={`flex-1 min-w-0 text-left px-3 py-2.5 ${
          isActive ? 'text-zinc-100' : 'text-zinc-400 group-hover:text-zinc-200'
        }`}
      >
        <div className="flex items-start gap-2">
          <svg
            className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${
              isActive ? 'text-blue-400' : 'text-zinc-600 group-hover:text-zinc-500'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="truncate leading-snug">{session.title}</p>
            {session.uploadedFile && (
              <p className="flex items-center gap-1 mt-0.5 text-xs text-zinc-600 truncate">
                <svg
                  className="w-2.5 h-2.5 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="truncate">{session.uploadedFile}</span>
              </p>
            )}
          </div>
        </div>
      </button>

      {/* Delete button — appears on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="Delete chat"
        className="flex-shrink-0 mr-1.5 p-1.5 rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>
  );
}
