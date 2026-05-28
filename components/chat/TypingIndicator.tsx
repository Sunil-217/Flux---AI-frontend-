export function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 flex-shrink-0 rounded-full bg-blue-600 flex items-center justify-center">
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
      <div className="flex items-center gap-1.5 py-3 px-1">
        <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" />
      </div>
    </div>
  );
}
