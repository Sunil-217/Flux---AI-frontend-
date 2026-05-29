'use client';

import { useRef, useEffect } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { EmptyState } from './EmptyState';
import { FileUpload } from '@/components/upload/FileUpload';
import type { ChatSession } from '@/types';

interface Props {
  session: ChatSession | null;
  isLoading: boolean;
  isUploading: boolean;
  uploadedFile: string | null;
  onSendMessage: (content: string) => void;
  onUploadFile: (file: File) => void;
  onNewChat: () => void;
  onToggleSidebar: () => void;
}

export function ChatArea({
  session,
  isLoading,
  isUploading,
  uploadedFile,
  onSendMessage,
  onUploadFile,
  onNewChat,
  onToggleSidebar,
}: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages.length, isLoading]);

  const hasMessages = (session?.messages.length ?? 0) > 0;

  const inputPlaceholder = !session
    ? 'Create a new chat to get started…'
    : !uploadedFile
    ? 'Upload a PDF first, then ask questions…'
    : `Ask anything about ${uploadedFile}…`;

  return (
    <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 flex-shrink-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={onToggleSidebar}
          className="md:hidden flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          aria-label="Toggle sidebar"
        >
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="min-w-0 flex-1 flex items-center gap-2">
          {session ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
              <h1 className="text-sm font-medium text-zinc-300 truncate">
                {session.title}
              </h1>
            </>
          ) : (
            <h1 className="text-sm font-medium text-zinc-500">
              Select or create a chat
            </h1>
          )}
        </div>
        <FileUpload
          onUpload={onUploadFile}
          isUploading={isUploading}
          uploadedFile={uploadedFile}
          disabled={!session}
        />
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          <EmptyState
            hasSession={!!session}
            uploadedFile={uploadedFile}
            onNewChat={onNewChat}
          />
        ) : (
          <div className="max-w-3xl mx-auto w-full px-6 py-6 space-y-6">
            {session!.messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-zinc-800 px-4 py-4">
        <div className="max-w-3xl mx-auto w-full">
          <ChatInput
            onSend={onSendMessage}
            disabled={isLoading || !session}
            placeholder={inputPlaceholder}
          />
          <p className="text-center text-[11px] text-zinc-700 mt-2">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </main>
  );
}
