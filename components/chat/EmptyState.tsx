interface Props {
  hasSession: boolean;
  uploadedFile: string | null;
  onNewChat: () => void;
}

export function EmptyState({ hasSession, uploadedFile, onNewChat }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center select-none">
      <div className="w-14 h-14 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mb-5">
        <svg
          className="w-7 h-7 text-blue-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>

      {!hasSession ? (
        <>
          <h2 className="text-base font-semibold text-zinc-200 mb-2">
            Welcome to Flux AI
          </h2>
          <p className="text-sm text-zinc-500 mb-6 max-w-xs leading-relaxed">
            Upload a PDF and ask questions about it. Each chat session is
            isolated with its own memory.
          </p>
          <button
            onClick={onNewChat}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white rounded-lg transition-colors"
          >
            Start New Chat
          </button>
        </>
      ) : !uploadedFile ? (
        <>
          <h2 className="text-base font-semibold text-zinc-200 mb-2">
            No document uploaded
          </h2>
          <p className="text-sm text-zinc-500 max-w-xs leading-relaxed">
            Click <span className="text-zinc-300">Upload PDF</span> in the
            header to attach a document to this session.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-base font-semibold text-zinc-200 mb-2">
            Ready to answer
          </h2>
          <p className="text-sm text-zinc-500 max-w-xs leading-relaxed">
            <span className="text-blue-400 font-medium">{uploadedFile}</span>{' '}
            is loaded. Ask anything about it using the input below.
          </p>
        </>
      )}
    </div>
  );
}
