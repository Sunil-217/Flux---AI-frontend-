'use client';

import { useState, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ChatArea } from '@/components/chat/ChatArea';
import { useChatSessions } from '@/hooks/useChatSessions';
import { useChat } from '@/hooks/useChat';
import { useFileUpload } from '@/hooks/useFileUpload';
import { deleteChat } from '@/services/api';
import type { HistoryMessage } from '@/services/api';

export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const {
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    createSession,
    addMessage,
    patchMessage,
    updateSession,
    deleteSession,
    deleteMessage,
    updateMessage,
  } = useChatSessions();

  const { isLoading, sendMessage, resendQuestion } = useChat(activeSessionId, {
    addMessage,
    patchMessage,
    persist: (id) => updateSession(id, {}),
  });

  const { isUploading, upload } = useFileUpload(
    activeSessionId,
    (filename) => {
      if (activeSessionId) {
        updateSession(activeSessionId, { uploadedFile: filename });
      }
    }
  );

  const uploadedFile = activeSession?.uploadedFile ?? null;

  // ── Sidebar handlers ──────────────────────────────────────────────────────
  const handleNewChat = () => {
    createSession();
    setIsSidebarOpen(false);
  };

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
    setIsSidebarOpen(false);
  };

  const handleDeleteSession = useCallback(
    (id: string) => {
      deleteSession(id);           // remove from UI immediately
      toast.success('Chat deleted');
      deleteChat(id).catch((err) => {
        console.error('Backend cleanup failed:', err);
        toast.error('Files not removed from server — restart the backend and try again.');
      });
    },
    [deleteSession]
  );

  // ── History builder ───────────────────────────────────────────────────────
  const buildHistory = useCallback((): HistoryMessage[] => {
    return (activeSession?.messages ?? []).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
  }, [activeSession]);

  // ── Message handlers ──────────────────────────────────────────────────────

  const handleSendMessage = useCallback(
    (content: string) => {
      sendMessage(content, buildHistory());
    },
    [sendMessage, buildHistory]
  );

  // Edit: update the user bubble, trim subsequent messages, re-ask the AI
  const handleEditMessage = useCallback(
    (messageId: string, newContent: string) => {
      if (!activeSessionId) return;
      // Build history from messages BEFORE the edited one (capture before mutation)
      const msgs = activeSession?.messages ?? [];
      const editedIdx = msgs.findIndex((m) => m.id === messageId);
      const history: HistoryMessage[] = msgs
        .slice(0, editedIdx)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      updateMessage(activeSessionId, messageId, newContent);
      resendQuestion(newContent, history);
    },
    [activeSessionId, activeSession, updateMessage, resendQuestion]
  );

  // Delete: remove the user message + its paired AI response
  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      if (!activeSessionId) return;
      deleteMessage(activeSessionId, messageId);
    },
    [activeSessionId, deleteMessage]
  );

  return (
    <div className="flex h-screen text-[var(--ink)] overflow-hidden">
      <Toaster
        position="top-right"
        gutter={8}
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--elevated)',
            color: 'var(--ink)',
            border: '1px solid var(--line)',
            fontSize: '13px',
            borderRadius: '14px',
            padding: '10px 14px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.28)',
            backdropFilter: 'blur(12px)',
          },
          success: {
            iconTheme: { primary: '#7c6cff', secondary: 'var(--elevated)' },
          },
          error: {
            iconTheme: { primary: '#f87171', secondary: 'var(--elevated)' },
          },
        }}
      />

      {/* Mobile backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
      />

      <ChatArea
        session={activeSession}
        isLoading={isLoading}
        isUploading={isUploading}
        uploadedFile={uploadedFile}
        onSendMessage={handleSendMessage}
        onUploadFile={upload}
        onNewChat={handleNewChat}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onEditMessage={handleEditMessage}
        onDeleteMessage={handleDeleteMessage}
      />
    </div>
  );
}
