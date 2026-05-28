import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import type { Message } from '@/types';

const mdComponents: Components = {
  p: ({ children }) => (
    <p className="mb-3 last:mb-0 leading-relaxed text-zinc-200">{children}</p>
  ),
  h1: ({ children }) => (
    <h1 className="text-xl font-semibold mb-3 mt-5 first:mt-0 text-zinc-100">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold mb-2 mt-4 first:mt-0 text-zinc-100">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold mb-2 mt-3 first:mt-0 text-zinc-200">
      {children}
    </h3>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-outside pl-5 mb-3 space-y-1 text-zinc-200">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside pl-5 mb-3 space-y-1 text-zinc-200">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  pre: ({ children }) => (
    <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-xs overflow-x-auto mb-3 font-mono">
      {children}
    </pre>
  ),
  code: ({ children, className }) => {
    const isBlock = Boolean(className);
    if (isBlock) {
      return (
        <code className={`${className ?? ''} text-zinc-300 text-xs font-mono`}>
          {children}
        </code>
      );
    }
    return (
      <code className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs text-blue-300 font-mono">
        {children}
      </code>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-zinc-700 pl-4 text-zinc-400 italic mb-3">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-zinc-100">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-zinc-300">{children}</em>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="border-zinc-800 my-4" />,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-3 rounded-lg border border-zinc-800">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-zinc-800 px-3 py-2 text-left text-xs font-semibold text-zinc-300 bg-zinc-900">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-zinc-800/50 px-3 py-2 text-sm text-zinc-400">
      {children}
    </td>
  ),
};

interface Props {
  message: Message;
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center ${
          isUser ? 'bg-zinc-700' : 'bg-blue-600'
        }`}
      >
        {isUser ? (
          <svg
            className="w-3.5 h-3.5 text-zinc-300"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
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
        )}
      </div>

      {/* Bubble */}
      <div className={`max-w-[82%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            isUser
              ? 'bg-zinc-800 text-zinc-100 rounded-tr-sm'
              : 'text-zinc-200 rounded-tl-sm'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap leading-relaxed">
              {message.content}
            </p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={mdComponents}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>

        {/* Sources */}
        {!isUser &&
          message.sources &&
          message.sources.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {message.sources.map((src, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1"
                >
                  <svg
                    className="w-3 h-3 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>
                    {src.source ?? `Source ${i + 1}`}
                    {src.page != null && `, p.${src.page}`}
                  </span>
                </span>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
