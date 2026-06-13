'use client';

import { useRef, useEffect, useState, type DragEvent } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { EmptyState } from './EmptyState';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { AccentPicker } from '@/components/layout/AccentPicker';
import { SummaryModal } from '@/components/layout/SummaryModal';
import { summarizeConversation, createShare, apiError, WEB_SEARCH_KEY, activeDocsKey } from '@/services/api';
import { useT } from '@/lib/i18n';
import toast from 'react-hot-toast';
import type { ChatSession, Folder } from '@/types';

interface Props {
  session: ChatSession | null;
  isLoading: boolean;
  isUploading: boolean;
  uploadedFile: string | null;
  uploadedFiles: string[];
  onSendMessage: (content: string, image?: string) => void;
  onUploadFile: (file: File) => void;
  onUploadFiles: (files: File[]) => void;
  onNewChat: () => void;
  onToggleSidebar: () => void;
  onEditMessage: (messageId: string, newContent: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onStop: () => void;
  onRegenerate: () => void;
  onRegenerateMedia: (kind: 'image' | 'video' | 'pdf' | 'excel' | 'word' | 'ppt', prompt: string) => void;
  onVariant: (messageId: string, index: number) => void;
  onAddUrl: () => void;
  followups: string[];
  onPickFollowup: (q: string) => void;
  injectText?: { text: string; n: number } | null;
  // Workspace Home data: lets the empty state show the Agenda + "continue
  // where you left off" + knowledge totals instead of a blank-chat greeting.
  allSessions?: ChatSession[];
  allFolders?: Folder[];
  onSelectSession?: (id: string) => void;
}

export function ChatArea({
  session,
  isLoading,
  isUploading,
  uploadedFile,
  uploadedFiles,
  onSendMessage,
  onUploadFile,
  onUploadFiles,
  onNewChat,
  onToggleSidebar,
  onEditMessage,
  onDeleteMessage,
  onStop,
  onRegenerate,
  onRegenerateMedia,
  onVariant,
  onAddUrl,
  followups,
  onPickFollowup,
  injectText,
  allSessions,
  allFolders,
  onSelectSession,
}: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const [webOn, setWebOn] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  // Mobile-only overflow menu: secondary header actions (summarise / share /
  // export) collapse into this so the title isn't crushed on a phone.
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const [docOpen, setDocOpen] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

  useEffect(() => {
    setWebOn(localStorage.getItem(WEB_SEARCH_KEY) !== 'off');
  }, []);

  // Load the per-chat document selection (default: all docs).
  useEffect(() => {
    if (!session) {
      setSelectedDocs([]);
      return;
    }
    try {
      const raw = localStorage.getItem(activeDocsKey(session.id));
      const saved = raw ? JSON.parse(raw) : null;
      if (Array.isArray(saved) && saved.length) {
        setSelectedDocs(uploadedFiles.filter((f) => saved.includes(f)));
      } else {
        setSelectedDocs(uploadedFiles);
      }
    } catch {
      setSelectedDocs(uploadedFiles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, uploadedFiles.length]);

  useEffect(() => {
    if (!docOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (docRef.current && !docRef.current.contains(e.target as Node)) setDocOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [docOpen]);

  const toggleDoc = (file: string) => {
    if (!session) return;
    setSelectedDocs((prev) => {
      const next = prev.includes(file) ? prev.filter((f) => f !== file) : [...prev, file];
      try {
        localStorage.setItem(activeDocsKey(session.id), JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  useEffect(() => {
    if (!exportOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [exportOpen]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [moreOpen]);

  const toggleWeb = () =>
    setWebOn((prev) => {
      const next = !prev;
      try {
        if (next) localStorage.removeItem(WEB_SEARCH_KEY);
        else localStorage.setItem(WEB_SEARCH_KEY, 'off');
      } catch {
        /* ignore */
      }
      return next;
    });

  const doSummary = () => {
    if (!session || session.messages.length === 0) return;
    setSummary('');
    setSummarizing(true);
    summarizeConversation(session.messages.map((m) => ({ role: m.role, content: m.content })))
      .then((s) => setSummary(s || ''))
      .catch(() => setSummary(''))
      .finally(() => setSummarizing(false));
  };

  const doShare = () => {
    if (!session || session.messages.length === 0) return;
    const tid = toast.loading('Creating share link…');
    createShare(
      session.title || 'Shared chat',
      session.messages.map((m) => ({ role: m.role, content: m.content, image: m.image }))
    )
      .then((id) => {
        const link = `${window.location.origin}/share/${id}`;
        navigator.clipboard?.writeText(link).catch(() => {});
        toast.success('Public link copied to clipboard', { id: tid });
      })
      .catch((e) => toast.error(apiError(e, 'Could not create a share link.'), { id: tid }));
  };

  const messages = session?.messages ?? [];
  const lastMessage = messages[messages.length - 1];
  const hasMessages = messages.length > 0;
  // Show the typing dots only until the assistant's first token streams in.
  const awaitingReply =
    isLoading && (messages.length === 0 || lastMessage?.role === 'user');

  const isNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 160;
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') =>
    endRef.current?.scrollIntoView({ behavior });

  // Jump straight to the latest when switching into a chat.
  useEffect(() => {
    scrollToBottom('auto');
  }, [session?.id]);

  // While streaming, only follow along if the user is already near the bottom
  // (so scrolling up to re-read isn't yanked back down — like Claude).
  useEffect(() => {
    if (isNearBottom()) scrollToBottom('smooth');
  }, [messages.length, lastMessage?.content.length, isLoading]);

  const handleScroll = () => setShowScrollDown(!isNearBottom());

  const exportChat = () => {
    if (!session) return;
    const md =
      `# ${session.title}\n\n` +
      session.messages
        .map((m) => `**${m.role === 'user' ? 'You' : 'Close AI'}:**\n\n${m.content}`)
        .join('\n\n---\n\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(session.title || 'chat').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Drag-and-drop a file anywhere on the chat to upload it.
  const onDragEnter = (e: DragEvent) => {
    if (!session || isUploading) return;
    if (!Array.from(e.dataTransfer?.types ?? []).includes('Files')) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragOver = (e: DragEvent) => {
    if (dragging) e.preventDefault();
  };
  const onDragLeave = () => {
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragging(false);
    }
  };
  const onDrop = (e: DragEvent) => {
    if (!dragging) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const f = e.dataTransfer?.files?.[0];
    if (f && session && !isUploading) onUploadFile(f);
  };

  const t = useT();
  const inputPlaceholder = !session
    ? t('Create a new chat to get started…')
    : uploadedFile
    ? `Ask anything about ${uploadedFile}…`
    : t('Message Close AI…');

  return (
    <main
      className="relative flex-1 flex flex-col h-full min-w-0 overflow-hidden"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Drag-and-drop overlay */}
      {dragging && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[var(--base)]/80 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-3 px-10 py-8 rounded-2xl border-2 border-dashed border-[var(--accent)] bg-[var(--elevated)] shadow-2xl">
            <svg className="w-9 h-9 text-[var(--accent-fg)]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
            <p className="text-sm font-medium text-[var(--ink)]">Drop your file to upload</p>
            <p className="text-xs text-[var(--ink-3)]">PDF · DOCX · TXT · MD · CSV · JSON · code</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="relative flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-16 flex-shrink-0 bg-[var(--panel)] backdrop-blur-md">
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
              {uploadedFiles.length > 1
                ? `${uploadedFiles.length} documents · web-connected`
                : uploadedFile
                ? `Document · ${uploadedFile}`
                : 'General assistant · web-connected'}
            </p>
          )}
        </div>

        {uploadedFiles.length >= 2 && (
          <div ref={docRef} className="relative flex-shrink-0">
            <button
              onClick={() => setDocOpen((o) => !o)}
              title="Choose which documents to search"
              aria-label="Choose documents"
              className="h-9 px-2.5 flex items-center gap-1.5 rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors"
            >
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h10M7 16h6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
              </svg>
              <span className="text-xs font-medium">
                {selectedDocs.length}/{uploadedFiles.length}
              </span>
            </button>
            {docOpen && (
              <div className="absolute right-0 top-11 z-50 w-64 max-h-72 overflow-y-auto rounded-xl bg-[var(--elevated)] border border-[var(--line-strong)] shadow-xl py-1.5">
                <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-[var(--ink-4)]">Search in</p>
                {uploadedFiles.map((f) => {
                  const on = selectedDocs.includes(f);
                  return (
                    <button
                      key={f}
                      onClick={() => toggleDoc(f)}
                      className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--fill)]"
                    >
                      <span
                        className={`w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center ${
                          on ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--line-strong)]'
                        }`}
                      >
                        {on && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="truncate text-[var(--ink-2)]">{f}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {hasMessages && (
          <button
            onClick={doSummary}
            title="Summarise this conversation"
            aria-label="Summarise conversation"
            className="flex-shrink-0 w-9 h-9 hidden md:flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors"
          >
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10M4 18h7" />
            </svg>
          </button>
        )}

        <button
          onClick={toggleWeb}
          title={webOn ? 'Web search: ON (click to turn off)' : 'Web search: OFF (click to turn on)'}
          aria-label="Toggle web search"
          className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
            webOn
              ? 'text-[var(--accent-fg)] hover:bg-[var(--fill)]'
              : 'text-[var(--ink-4)] hover:text-[var(--ink)] hover:bg-[var(--fill)]'
          }`}
        >
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
            {!webOn && <path strokeLinecap="round" strokeLinejoin="round" d="M4 4l16 16" />}
          </svg>
        </button>

        {hasMessages && (
          <button
            onClick={doShare}
            title="Share a read-only link"
            aria-label="Share chat"
            className="flex-shrink-0 w-9 h-9 hidden md:flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors"
          >
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
            </svg>
          </button>
        )}

        {hasMessages && (
          <div ref={exportRef} className="relative flex-shrink-0 hidden md:block">
            <button
              onClick={() => setExportOpen((o) => !o)}
              title="Export / download"
              aria-label="Export chat"
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors"
            >
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
              </svg>
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-11 z-50 w-44 rounded-xl bg-[var(--elevated)] border border-[var(--line-strong)] shadow-xl py-1">
                <button
                  onClick={() => {
                    exportChat();
                    setExportOpen(false);
                  }}
                  className="flex items-center gap-2 w-full text-left px-3.5 py-2 text-sm text-[var(--ink-2)] hover:bg-[var(--fill)] hover:text-[var(--ink)]"
                >
                  <span className="text-[var(--ink-4)] text-xs font-mono">md</span> Markdown file
                </button>
                <button
                  onClick={() => {
                    setExportOpen(false);
                    setTimeout(() => window.print(), 60);
                  }}
                  className="flex items-center gap-2 w-full text-left px-3.5 py-2 text-sm text-[var(--ink-2)] hover:bg-[var(--fill)] hover:text-[var(--ink)]"
                >
                  <span className="text-[var(--ink-4)] text-xs font-mono">pdf</span> PDF / Print
                </button>
              </div>
            )}
          </div>
        )}

        {hasMessages && (
          <span className="hidden md:inline-flex">
            <AccentPicker />
          </span>
        )}

        <ThemeToggle />

        {/* Mobile overflow — secondary actions live here so the phone header
            stays uncluttered (summarise / share / export are desktop-inline). */}
        {hasMessages && (
          <div ref={moreRef} className="relative flex-shrink-0 md:hidden">
            <button
              onClick={() => setMoreOpen((o) => !o)}
              title="More actions"
              aria-label="More actions"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="5" cy="12" r="1.6" />
                <circle cx="12" cy="12" r="1.6" />
                <circle cx="19" cy="12" r="1.6" />
              </svg>
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-11 z-50 w-48 rounded-xl bg-[var(--elevated)] border border-[var(--line-strong)] shadow-xl py-1">
                <button
                  onClick={() => {
                    doSummary();
                    setMoreOpen(false);
                  }}
                  className="flex items-center gap-2.5 w-full text-left px-3.5 py-2 text-sm text-[var(--ink-2)] hover:bg-[var(--fill)] hover:text-[var(--ink)]"
                >
                  <svg className="w-4 h-4 flex-shrink-0 text-[var(--ink-3)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10M4 18h7" />
                  </svg>
                  Summarise
                </button>
                <button
                  onClick={() => {
                    doShare();
                    setMoreOpen(false);
                  }}
                  className="flex items-center gap-2.5 w-full text-left px-3.5 py-2 text-sm text-[var(--ink-2)] hover:bg-[var(--fill)] hover:text-[var(--ink)]"
                >
                  <svg className="w-4 h-4 flex-shrink-0 text-[var(--ink-3)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
                  </svg>
                  Share link
                </button>
                <button
                  onClick={() => {
                    exportChat();
                    setMoreOpen(false);
                  }}
                  className="flex items-center gap-2.5 w-full text-left px-3.5 py-2 text-sm text-[var(--ink-2)] hover:bg-[var(--fill)] hover:text-[var(--ink)]"
                >
                  <span className="w-4 flex-shrink-0 text-center text-[var(--ink-4)] text-xs font-mono">md</span>
                  Download Markdown
                </button>
                <button
                  onClick={() => {
                    setMoreOpen(false);
                    setTimeout(() => window.print(), 60);
                  }}
                  className="flex items-center gap-2.5 w-full text-left px-3.5 py-2 text-sm text-[var(--ink-2)] hover:bg-[var(--fill)] hover:text-[var(--ink)]"
                >
                  <span className="w-4 flex-shrink-0 text-center text-[var(--ink-4)] text-xs font-mono">pdf</span>
                  Print / PDF
                </button>
              </div>
            )}
          </div>
        )}

        <div className="divider-glow absolute bottom-0 inset-x-0 h-px" />
      </header>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          <EmptyState
            hasSession={!!session}
            uploadedFile={uploadedFile}
            onNewChat={onNewChat}
            allSessions={allSessions}
            allFolders={allFolders}
            currentSessionId={session?.id}
            onSelectSession={onSelectSession}
          />
        ) : (
          <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 space-y-7">
            {session!.messages.map((msg, i) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onEdit={onEditMessage}
                onDelete={onDeleteMessage}
                onVariant={onVariant}
                onRegenerateMedia={onRegenerateMedia}
                streaming={
                  isLoading && i === session!.messages.length - 1 && msg.role === 'assistant'
                }
              />
            ))}
            {awaitingReply && <TypingIndicator />}
            {!isLoading && followups.length > 0 && lastMessage?.role === 'assistant' && (
              <div className="flex flex-wrap gap-2 pt-1">
                {followups.map((q) => (
                  <button
                    key={q}
                    onClick={() => onPickFollowup(q)}
                    className="inline-flex items-center gap-1.5 text-left text-[13px] text-[var(--ink-2)] border border-[var(--line)] hover:border-[var(--line-strong)] hover:bg-[var(--fill)] rounded-lg px-3 py-1.5 transition-colors"
                  >
                    <svg className="w-3 h-3 flex-shrink-0 text-[var(--accent-fg)]" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    {q}
                  </button>
                ))}
              </div>
            )}
            {!isLoading && lastMessage?.role === 'assistant' && (
              <div className="flex justify-center pt-1">
                <button
                  onClick={onRegenerate}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-3)] hover:text-[var(--ink)] border border-[var(--line)] hover:border-[var(--line-strong)] hover:bg-[var(--fill)] rounded-lg px-3 py-1.5 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate
                </button>
              </div>
            )}
            <div ref={endRef} className="h-px" />
          </div>
        )}
      </div>

      {/* Scroll-to-bottom button */}
      {showScrollDown && hasMessages && (
        <button
          onClick={() => scrollToBottom('smooth')}
          aria-label="Scroll to bottom"
          className="absolute left-1/2 -translate-x-1/2 bottom-28 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-[var(--elevated)] border border-[var(--line-strong)] text-[var(--ink-2)] shadow-lg hover:bg-[var(--fill-hover)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}

      {/* Input */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2 print:hidden">
        <div className="max-w-3xl mx-auto w-full">
          <ChatInput
            onSend={onSendMessage}
            disabled={isLoading || !session}
            placeholder={inputPlaceholder}
            isStreaming={isLoading}
            onStop={onStop}
            injectText={injectText}
            onUploadFiles={onUploadFiles}
            onAddUrl={onAddUrl}
          />
          <p className="text-center text-[11px] text-[var(--ink-4)] mt-2.5">
            Close AI can search the web and may make mistakes. Verify important info.
          </p>
        </div>
      </div>

      {summary !== null && (
        <SummaryModal summary={summary} loading={summarizing} onClose={() => setSummary(null)} />
      )}
    </main>
  );
}
