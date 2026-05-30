'use client';

import { useRef, useEffect } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { EmptyState } from './EmptyState';
import { FileUpload } from '@/components/upload/FileUpload';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
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
  onEditMessage: (messageId: string, newContent: string) => void;
  onDeleteMessage: (messageId: string) => void;
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
  onEditMessage,
  onDeleteMessage,
}: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages.length, isLoading]);

  const hasMessages = (session?.messages.length ?? 0) > 0;

  const inputPlaceholder = !session
    ? 'Create a new chat to get started…'
    : uploadedFile
    ? `Ask anything about ${uploadedFile}…`
    : 'Message Close AI…';

  return (
    <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
      {/* Header */}
      <header className="relative flex items-center gap-3 px-4 h-16 flex-shrink-0 bg-[var(--panel)] backdrop-blur-md">
        <button
          onClick={onToggleSidebar}
          className="md:hidden flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors"
          aria-label="Toggle sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-[var(--ink)] truncate tracking-tight">
            {session ? session.title : 'Close AI'}
          </h1>
          {session && (
            <p className="text-[11px] text-[var(--ink-3)] truncate leading-none mt-0.5">
              {uploadedFile ? `Document · ${uploadedFile}` : 'General assistant · web-connected'}
            </p>
          )}
        </div>

        <ThemeToggle />

        <FileUpload
          onUpload={onUploadFile}
          isUploading={isUploading}
          uploadedFile={uploadedFile}
          disabled={!session}
        />

        <div className="divider-glow absolute bottom-0 inset-x-0 h-px" />
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
          <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 space-y-7">
            {session!.messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onEdit={onEditMessage}
                onDelete={onDeleteMessage}
              />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={endRef} className="h-px" />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2">
        <div className="max-w-3xl mx-auto w-full">
          <ChatInput
            onSend={onSendMessage}
            disabled={isLoading || !session}
            placeholder={inputPlaceholder}
          />
          <p className="text-center text-[11px] text-[var(--ink-4)] mt-2.5">
            Close AI can search the web and may make mistakes. Verify important info.
          </p>
        </div>
      </div>
    </main>
  );
}
