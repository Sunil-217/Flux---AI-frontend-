'use client';

import { useState, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ChatArea } from '@/components/chat/ChatArea';
import { useChatSessions } from '@/hooks/useChatSessions';
import { useChat } from '@/hooks/useChat';
import { useFileUpload } from '@/hooks/useFileUpload';
import { deleteChat } from '@/services/api';

export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const {
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    createSession,
    addMessage,
    updateSession,
    deleteSession,
  } = useChatSessions();

  const { isLoading, sendMessage } = useChat(activeSessionId, addMessage);

  const { isUploading, upload } = useFileUpload(
    activeSessionId,
    (filename) => {
      if (activeSessionId) {
        updateSession(activeSessionId, { uploadedFile: filename });
      }
    }
  );

  const uploadedFile = activeSession?.uploadedFile ?? null;

  // --- handlers ---

  const handleNewChat = () => {
    createSession();
    setIsSidebarOpen(false); // close on mobile after action
  };

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
    setIsSidebarOpen(false); // close on mobile after selection
  };

  const handleDeleteSession = useCallback(
    (id: string) => {
      deleteSession(id); // removes from localStorage immediately
      toast.success('Chat deleted');
      // Fire-and-forget: clean up vectors/files on the backend
      deleteChat(id).catch(() => {
        // Backend cleanup failed — local delete already done, no user action needed
      });
    },
    [deleteSession]
  );

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <Toaster
        position="bottom-right"
        gutter={8}
        toastOptions={{
          duration: 4000,
          style: {
            background: '#18181b',
            color: '#e4e4e7',
            border: '1px solid #27272a',
            fontSize: '13px',
            borderRadius: '10px',
            padding: '10px 14px',
          },
          success: {
            iconTheme: { primary: '#3b82f6', secondary: '#18181b' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#18181b' },
          },
        }}
      />

      {/* Mobile backdrop — click outside sidebar to close */}
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
        onSendMessage={sendMessage}
        onUploadFile={upload}
        onNewChat={handleNewChat}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
      />
    </div>
  );
}
