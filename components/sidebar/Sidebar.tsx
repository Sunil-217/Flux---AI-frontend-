import { useState } from 'react';
import { useT } from '@/lib/i18n';
import { PromptModal, ConfirmModal } from '@/components/layout/Dialogs';
import { NewChatButton } from './NewChatButton';
import { ChatListItem } from './ChatListItem';
import { Logo } from '@/components/layout/Logo';
import { SettingsModal } from '@/components/layout/SettingsModal';
import { AdminPanel } from '@/components/layout/AdminPanel';
import { useAuth } from '@/components/auth/AuthProvider';
import { useFeatures } from '@/components/providers/FeatureProvider';
import type { ChatSession, Folder, CodeSession } from '@/types';

interface Props {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isOpen: boolean;
  folders: Folder[];
  onClose: () => void;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onTogglePin: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onCreateFolder: (name: string) => string;
  onRenameFolder: (id: string, name: string) => void;
  onSetFolderInstructions: (id: string, instructions: string) => void;
  onNewChatInFolder: (folderId: string) => void;
  onDeleteFolder: (id: string) => void;
  onAssignFolder: (chatId: string, folderId: string | null) => void;
  onClearChats: () => void;
  mode: 'chat' | 'code';
  onModeChange: (m: 'chat' | 'code') => void;
  // ── Code mode: a separate session list (isolated from chat sessions) ──
  codeSessions: CodeSession[];
  activeCodeSessionId: string | null;
  onNewCodeChat: () => void;
  onSelectCodeSession: (id: string) => void;
  onDeleteCodeSession: (id: string) => void;
  onRenameCodeSession: (id: string, title: string) => void;
  // ── Library: the accumulated-intelligence surface ──
  onOpenLibrary: () => void;
}

const byRecent = (a: ChatSession, b: ChatSession) =>
  (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0);

// Bucket chats into Today / Yesterday / Previous 7 days / Older, newest first.
function groupByDate(sessions: ChatSession[]) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startYesterday = startToday - 86_400_000;
  const start7 = startToday - 7 * 86_400_000;

  const groups: { label: string; items: ChatSession[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 days', items: [] },
    { label: 'Older', items: [] },
  ];

  [...sessions].sort(byRecent).forEach((s) => {
    const t = s.updatedAt ?? s.createdAt ?? 0;
    if (t >= startToday) groups[0].items.push(s);
    else if (t >= startYesterday) groups[1].items.push(s);
    else if (t >= start7) groups[2].items.push(s);
    else groups[3].items.push(s);
  });

  return groups.filter((g) => g.items.length > 0);
}

export function Sidebar({
  sessions,
  activeSessionId,
  isOpen,
  folders,
  onClose,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  onTogglePin,
  onToggleArchive,
  onCreateFolder,
  onRenameFolder,
  onSetFolderInstructions,
  onNewChatInFolder,
  onDeleteFolder,
  onAssignFolder,
  onClearChats,
  mode,
  onModeChange,
  codeSessions,
  activeCodeSessionId,
  onNewCodeChat,
  onSelectCodeSession,
  onDeleteCodeSession,
  onRenameCodeSession,
  onOpenLibrary,
}: Props) {
  const { user, logout } = useAuth();
  const { enabled } = useFeatures();
  const t = useT();
  const isCode = mode === 'code';
  const [query, setQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [promptCfg, setPromptCfg] = useState<{
    title: string;
    placeholder?: string;
    initialValue?: string;
    multiline?: boolean;
    allowEmpty?: boolean;
    confirmLabel?: string;
    onSubmit: (v: string) => void;
  } | null>(null);
  const [confirmCfg, setConfirmCfg] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const searching = query.trim().length > 0;
  const queryLower = query.trim().toLowerCase();
  const filtered = searching
    ? sessions.filter((s) => {
        // Match title OR message content (full-text chat search)
        const titleMatch = s.title.toLowerCase().includes(queryLower);
        const contentMatch = s.messages?.some((m) => m.content.toLowerCase().includes(queryLower));
        return titleMatch || contentMatch;
      })
    : sessions;

  // Code-mode session list (separate from chat sessions), most-recent first.
  const codeFiltered = (searching
    ? codeSessions.filter((s) => s.title.toLowerCase().includes(query.trim().toLowerCase()))
    : codeSessions
  )
    .slice()
    .sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0));

  const renderCodeItem = (s: CodeSession) => (
    <div
      key={s.id}
      className={`group/ci flex items-center rounded-lg ${s.id === activeCodeSessionId ? 'bg-[var(--fill-strong)]' : 'hover:bg-[var(--fill)]'}`}
    >
      <button
        onClick={() => onSelectCodeSession(s.id)}
        className="flex items-center gap-2 flex-1 min-w-0 px-2.5 py-2 text-left"
        title={s.folderName ? `${s.title} · ${s.folderName}` : s.title}
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0 text-[var(--accent-fg)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[13px] ${s.id === activeCodeSessionId ? 'text-[var(--ink)]' : 'text-[var(--ink-2)]'}`}>{s.title}</span>
          {s.folderName && <span className="block truncate text-[10px] text-[var(--ink-4)]">{s.folderName}</span>}
        </span>
      </button>
      <div className="flex items-center pr-1 opacity-0 group-hover/ci:opacity-100 transition-opacity">
        <button
          onClick={() =>
            setPromptCfg({
              title: 'Rename code chat',
              placeholder: 'Title',
              initialValue: s.title,
              onSubmit: (n) => onRenameCodeSession(s.id, n),
            })
          }
          title="Rename"
          className="p-1 rounded text-[var(--ink-4)] hover:text-[var(--ink)]"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        </button>
        <button
          onClick={() =>
            setConfirmCfg({
              title: 'Delete code chat',
              message: `Delete "${s.title}"? This clears its conversation memory.`,
              onConfirm: () => onDeleteCodeSession(s.id),
            })
          }
          title="Delete"
          className="p-1 rounded text-[var(--ink-4)] hover:text-red-400"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </div>
  );

  const active = filtered.filter((s) => !s.archived);
  const archivedList = filtered.filter((s) => s.archived).sort(byRecent);
  const pinned = active.filter((s) => s.pinned).sort(byRecent);
  const unpinned = active.filter((s) => !s.pinned);
  const dateGroups = groupByDate(unpinned.filter((s) => !s.folderId));
  const folderHasMatch = (id: string) => unpinned.some((s) => s.folderId === id);

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const renderItem = (session: ChatSession) => (
    <ChatListItem
      key={session.id}
      session={session}
      isActive={session.id === activeSessionId}
      folders={folders}
      onClick={() => onSelectSession(session.id)}
      onDelete={() => onDeleteSession(session.id)}
      onRename={(title) => onRenameSession(session.id, title)}
      onPin={() => onTogglePin(session.id)}
      onArchive={() => onToggleArchive(session.id)}
      onAssignFolder={(fid) => onAssignFolder(session.id, fid)}
      onNewFolder={() => newFolderForChat(session.id)}
    />
  );

  const newFolder = () =>
    setPromptCfg({ title: 'New folder', placeholder: 'Folder name', onSubmit: (name) => onCreateFolder(name) });
  const newFolderForChat = (chatId: string) =>
    setPromptCfg({
      title: 'New folder',
      placeholder: 'Folder name',
      onSubmit: (name) => {
        const id = onCreateFolder(name);
        onAssignFolder(chatId, id);
      },
    });

  const hasResults =
    pinned.length > 0 ||
    dateGroups.length > 0 ||
    folders.some((f) => folderHasMatch(f.id)) ||
    archivedList.length > 0;
  const archivedCollapsed = collapsed.has('__archived__') && !searching;

  return (
    <aside
      className={[
        'flex flex-col bg-[var(--panel)] backdrop-blur-xl border-r border-[var(--line)]',
        'fixed inset-y-0 left-0 z-50',
        'md:relative md:inset-auto md:z-auto',
        'w-72 md:w-[270px] flex-shrink-0 h-full',
        'transition-transform duration-300 ease-out',
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      ].join(' ')}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 h-16 flex-shrink-0">
        <Logo size={34} />
        <div className="flex-1 min-w-0">
          <h1 className="text-[18px] font-display font-medium text-[var(--ink)] tracking-tight leading-none">Close AI</h1>
          <p className="text-[11px] text-[var(--ink-4)] mt-1 leading-none">
            Powered by <span className="text-[var(--accent-fg)] font-medium">Fluxera</span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors"
          aria-label="Close sidebar"
        >
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* New chat + Library (+ New project in chat mode only) */}
      <div className="px-3 pb-1 space-y-1.5">
        <NewChatButton onClick={isCode ? onNewCodeChat : onNewChat} />
        <button
          onClick={onOpenLibrary}
          className="w-full flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors"
        >
          <svg className="w-4 h-4 text-[var(--ink-4)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.25c-2.5-1.5-5.5-1.5-8 0v11.5c2.5-1.5 5.5-1.5 8 0m0-11.5c2.5-1.5 5.5-1.5 8 0v11.5c-2.5-1.5-5.5-1.5-8 0m0-11.5v11.5" />
          </svg>
          Library
        </button>
        {!isCode && (
          <button
            onClick={newFolder}
            className="w-full flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors"
          >
            <svg className="w-4 h-4 text-[var(--ink-4)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v4M10 12.5h4" />
            </svg>
            {t('New project')}
          </button>
        )}
      </div>

      {/* Search */}
      {(isCode ? codeSessions.length > 0 : sessions.length > 0) && (
        <div className="px-3 pt-2">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--ink-4)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isCode ? 'Search code chats…' : t('Search chats…')}
              className="w-full bg-[var(--fill)] border border-[var(--line)] rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-red-400/60 transition-colors"
            />
          </div>
        </div>
      )}

      {/* Code-mode session list (isolated from chat sessions) */}
      {isCode ? (
        <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-4 space-y-1">
          {codeFiltered.length === 0 ? (
            <div className="mt-12 px-4 text-center">
              <p className="text-sm text-[var(--ink-3)]">No code chats {searching ? 'found' : 'yet'}</p>
              {!searching && <p className="text-xs text-[var(--ink-4)] mt-1">Start one above to begin</p>}
            </div>
          ) : (
            codeFiltered.map(renderCodeItem)
          )}
        </nav>
      ) : (
      <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-4 space-y-3">
        {sessions.length === 0 ? (
          <div className="mt-12 px-4 text-center">
            <p className="text-sm text-[var(--ink-3)]">{t('No conversations yet')}</p>
            <p className="text-xs text-[var(--ink-4)] mt-1">{t('Start one above to begin')}</p>
          </div>
        ) : !hasResults ? (
          <div className="mt-8 px-4 text-center">
            <p className="text-sm text-[var(--ink-3)]">{t('No chats found')}</p>
          </div>
        ) : (
          <>
            {/* Pinned */}
            {pinned.length > 0 && (
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 px-2 pb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-4)]">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M11.48 3.5a.56.56 0 0 1 1.04 0l2.13 5.11 5.52.45c.5.04.7.66.32.99l-4.2 3.6 1.28 5.38a.56.56 0 0 1-.84.61L12 16.73l-4.73 2.91a.56.56 0 0 1-.84-.61l1.28-5.38-4.2-3.6a.56.56 0 0 1 .32-.99l5.52-.45 2.13-5.1Z" />
                  </svg>
                  {t('Pinned')}
                </p>
                {pinned.map(renderItem)}
              </div>
            )}

            {/* Folders */}
            {folders.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between px-2 pb-1">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-4)]">{t('Projects')}</p>
                  <button
                    onClick={newFolder}
                    title="New folder"
                    aria-label="New folder"
                    className="text-[var(--ink-4)] hover:text-[var(--ink)] transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                </div>
                {folders.map((f) => {
                  if (searching && !folderHasMatch(f.id)) return null;
                  const items = unpinned.filter((s) => s.folderId === f.id).sort(byRecent);
                  const isCollapsed = collapsed.has(f.id) && !searching;
                  return (
                    <div key={f.id}>
                      <div className="group/folder flex items-center rounded-lg hover:bg-[var(--fill)]">
                        <button
                          onClick={() => toggleCollapse(f.id)}
                          className="flex items-center gap-1.5 flex-1 min-w-0 px-2 py-2.5 text-left text-[13px] font-medium text-[var(--ink-2)]"
                        >
                          <svg
                            className={`w-3 h-3 flex-shrink-0 text-[var(--ink-4)] transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                            fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                          <svg className="w-3.5 h-3.5 flex-shrink-0 text-[var(--accent-fg)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                          </svg>
                          <span className="truncate">{f.name}</span>
                          <span className="text-[var(--ink-4)] text-xs">{items.length}</span>
                        </button>
                        <div className="flex items-center pr-1 opacity-0 group-hover/folder:opacity-100 transition-opacity">
                          <button
                            onClick={() => onNewChatInFolder(f.id)}
                            title="New chat in this folder"
                            className="p-1 rounded text-[var(--ink-4)] hover:text-[var(--ink)]"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                            </svg>
                          </button>
                          <button
                            onClick={() =>
                              setPromptCfg({
                                title: `${f.name} — instructions`,
                                placeholder:
                                  "e.g. I'm applying for GenAI engineer roles — tailor every answer to that.",
                                initialValue: f.instructions ?? '',
                                multiline: true,
                                allowEmpty: true,
                                confirmLabel: 'Save',
                                onSubmit: (t) => onSetFolderInstructions(f.id, t),
                              })
                            }
                            title="Folder instructions (applied to every chat here)"
                            className={`p-1 rounded hover:text-[var(--ink)] ${
                              f.instructions ? 'text-[var(--accent-fg)]' : 'text-[var(--ink-4)]'
                            }`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" />
                            </svg>
                          </button>
                          <button
                            onClick={() =>
                              setPromptCfg({
                                title: 'Rename folder',
                                placeholder: 'Folder name',
                                initialValue: f.name,
                                onSubmit: (n) => onRenameFolder(f.id, n),
                              })
                            }
                            title="Rename folder"
                            className="p-1 rounded text-[var(--ink-4)] hover:text-[var(--ink)]"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() =>
                              setConfirmCfg({
                                title: 'Delete folder',
                                message: `Delete "${f.name}"? Chats inside will be kept (unfiled).`,
                                onConfirm: () => onDeleteFolder(f.id),
                              })
                            }
                            title="Delete folder"
                            className="p-1 rounded text-[var(--ink-4)] hover:text-red-400"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {!isCollapsed && (
                        <div className="space-y-1 mt-1 ml-2 pl-1 border-l border-[var(--line)]">
                          {items.length > 0 ? (
                            items.map(renderItem)
                          ) : (
                            <p className="px-2 py-1 text-[11px] text-[var(--ink-4)] italic">Empty — move a chat here</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Date groups (unfiled) */}
            {dateGroups.map((group) => (
              <div key={group.label} className="space-y-1">
                <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-4)]">
                  {t(group.label)}
                </p>
                {group.items.map(renderItem)}
              </div>
            ))}

            {/* Archived */}
            {archivedList.length > 0 && (
              <div>
                <button
                  onClick={() => toggleCollapse('__archived__')}
                  className="flex items-center gap-1.5 w-full px-2 py-1 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-4)] hover:text-[var(--ink-2)]"
                >
                  <svg
                    className={`w-3 h-3 flex-shrink-0 transition-transform ${archivedCollapsed ? '-rotate-90' : ''}`}
                    fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 01-2-2V5a1 1 0 011-1h16a1 1 0 011 1v1a2 2 0 01-2 2M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8M10 12h4" />
                  </svg>
                  <span>{t('Archived')}</span>
                  <span className="text-[var(--ink-4)]">{archivedList.length}</span>
                </button>
                {!archivedCollapsed && (
                  <div className="space-y-1 mt-1 opacity-80">{archivedList.map(renderItem)}</div>
                )}
              </div>
            )}

          </>
        )}
      </nav>
      )}

      {/* Mode switcher — Chat / Code (Claude-style), just above the profile.
          Code mode is a desktop-only surface (hidden on phones) and can be
          switched off platform-wide by an admin. */}
      <div className={`${enabled('code_mode') ? 'hidden md:block' : 'hidden'} px-3 pt-2`}>
        <div className="flex w-full rounded-lg border border-[var(--line)] bg-[var(--base)] p-0.5">
          {([['chat', 'Chat'], ['code', 'Code']] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === m
                  ? 'bg-[var(--fill-strong)] text-[var(--ink)]'
                  : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
              }`}
            >
              {m === 'chat' ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-9 6l3.5-2H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              )}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Admin Panel — only rendered for platform admins */}
      {user?.is_admin && (
        <div className="px-3 pt-2">
          <button
            onClick={() => setAdminOpen(true)}
            className="w-full flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium text-[var(--accent-fg)] border border-[var(--accent)]/30 bg-[var(--accent)]/5 hover:bg-[var(--accent)]/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12l1.8 1.8L15 10" />
            </svg>
            Admin Panel
          </button>
        </div>
      )}

      {/* User + sign out */}
      <div className="border-t border-[var(--line)] p-3 mt-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--ink)] truncate">{user?.name}</p>
            <p className="text-[11px] text-[var(--ink-4)] truncate">{user?.email}</p>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            aria-label="Settings"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors flex-shrink-0"
          >
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0"
          >
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      {settingsOpen && (
        <SettingsModal onClose={() => setSettingsOpen(false)} onClearChats={onClearChats} />
      )}

      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}

      {promptCfg && (
        <PromptModal
          title={promptCfg.title}
          placeholder={promptCfg.placeholder}
          initialValue={promptCfg.initialValue}
          multiline={promptCfg.multiline}
          allowEmpty={promptCfg.allowEmpty}
          confirmLabel={promptCfg.confirmLabel ?? (promptCfg.initialValue ? 'Save' : 'Create')}
          onSubmit={promptCfg.onSubmit}
          onClose={() => setPromptCfg(null)}
        />
      )}

      {confirmCfg && (
        <ConfirmModal
          title={confirmCfg.title}
          message={confirmCfg.message}
          confirmLabel="Delete"
          danger
          onConfirm={confirmCfg.onConfirm}
          onClose={() => setConfirmCfg(null)}
        />
      )}
    </aside>
  );
}
