'use client';

import { Toaster } from 'react-hot-toast';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ChatArea } from '@/components/chat/ChatArea';
import { useChatSessions } from '@/hooks/useChatSessions';
import { useChat } from '@/hooks/useChat';
import { useFileUpload } from '@/hooks/useFileUpload';

export function AppLayout() {
  const {
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    createSession,
    addMessage,
    updateSession,
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

  const handleNewChat = () => {
    createSession();
  };

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
  };

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

      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
      />

      <ChatArea
        session={activeSession}
        isLoading={isLoading}
        isUploading={isUploading}
        uploadedFile={uploadedFile}
        onSendMessage={sendMessage}
        onUploadFile={upload}
        onNewChat={handleNewChat}
      />
    </div>
  );
}
