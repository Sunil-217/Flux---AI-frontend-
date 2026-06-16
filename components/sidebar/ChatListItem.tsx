'use client';

import { useState, useRef, useEffect } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import type { ChatSession, Folder } from '@/types';

interface Props {
  session: ChatSession;
  isActive: boolean;
  folders: Folder[];
  onClick: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
  onPin: () => void;
  onArchive: () => void;
  onAssignFolder: (folderId: string | null) => void;
  onNewFolder: () => void;
}

export function ChatListItem({
  session,
  isActive,
  folders,
  onClick,
  onDelete,
  onRename,
  onPin,
  onArchive,
  onAssignFolder,
  onNewFolder,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(session.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const startRename = (e: MouseEvent) => {
    e.stopPropagation();
    setValue(session.title);
    setEditing(true);
  };
  const commit = () => {
    const t = value.trim();
    if (t && t !== session.title) onRename(t);
    setEditing(false);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    }
    if (e.key === 'Escape') {
      setValue(session.title);
      setEditing(false);
    }
  };

  const pickFolder = (e: MouseEvent, folderId: string | null) => {
    e.stopPropagation();
    onAssignFolder(folderId);
    setMenuOpen(false);
  };
  return (
    <div
      className={`group relative flex items-center rounded-xl text-sm transition-colors ${
        isActive
          ? 'bg-[var(--fill-strong)] border border-[var(--line)]'
          : 'border border-transparent hover:bg-[var(--fill)]'
      }`}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
      )}

      {editing ? (
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          onBlur={commit}
          className="flex-1 min-w-0 bg-transparent text-[var(--ink)] pl-3.5 pr-2 py-2.5 outline-none border-b border-[var(--accent)]/60 font-medium"
        />
      ) : (
        <button
          onClick={onClick}
          onDoubleClick={startRename}
          className={`flex-1 min-w-0 text-left pl-3.5 pr-2 py-2.5 ${
            isActive ? 'text-[var(--ink)]' : 'text-[var(--ink-3)] group-hover:text-[var(--ink-2)]'
          }`}
        >
          <p className="truncate leading-snug font-medium">{session.title}</p>
          {session.uploadedFile && (
            <p className="flex items-center gap-1 mt-0.5 text-[11px] text-[var(--ink-4)] truncate">
              <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="truncate">{session.uploadedFile}</span>
            </p>
          )}
        </button>
      )}

      {!editing && (
        <div className="flex items-center flex-shrink-0 mr-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPin();
            }}
            aria-label={session.pinned ? 'Unpin chat' : 'Pin chat'}
            title={session.pinned ? 'Unpin' : 'Pin to top'}
            className={`p-1.5 rounded-lg transition-all hover:bg-[var(--fill)] ${
              session.pinned
                ? 'text-[var(--accent-fg)] opacity-100'
                : 'text-[var(--ink-4)] hover:text-[var(--ink)] opacity-0 group-hover:opacity-100'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill={session.pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
          <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all">
            <div ref={menuRef} className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((o) => !o);
                }}
                aria-label="Move to folder"
                title="Move to folder"
                className="p-1.5 rounded-lg text-[var(--ink-4)] hover:text-[var(--ink)] hover:bg-[var(--fill)]"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-9 z-50 w-44 max-h-64 overflow-y-auto rounded-xl bg-[var(--elevated)] border border-[var(--line-strong)] shadow-xl py-1">
                  <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-[var(--ink-4)]">Move to</p>
                  {session.folderId && (
                    <button
                      onClick={(e) => pickFolder(e, null)}
                      className="w-full text-left px-3 py-1.5 text-sm text-[var(--ink-3)] hover:bg-[var(--fill)] hover:text-[var(--ink)]"
                    >
                      Remove from folder
                    </button>
                  )}
                  {folders.map((f) => (
                    <button
                      key={f.id}
                      onClick={(e) => pickFolder(e, f.id)}
                      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--fill)] truncate ${
                        session.folderId === f.id ? 'text-[var(--accent-fg)]' : 'text-[var(--ink-2)]'
                      }`}
                    >
                      {f.name}
                    </button>
                  ))}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNewFolder();
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm text-[var(--ink-3)] hover:bg-[var(--fill)] hover:text-[var(--ink)] border-t border-[var(--line)] mt-1"
                  >
                    + New folder…
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchive();
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm text-[var(--ink-3)] hover:bg-[var(--fill)] hover:text-[var(--ink)] border-t border-[var(--line)]"
                  >
                    {session.archived ? 'Unarchive' : 'Archive'}
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={startRename}
              aria-label="Rename chat"
              title="Rename"
              className="p-1.5 rounded-lg text-[var(--ink-4)] hover:text-[var(--ink)] hover:bg-[var(--fill)]"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              aria-label="Delete chat"
              title="Delete"
              className="p-1.5 rounded-lg text-[var(--ink-4)] hover:text-red-400 hover:bg-red-400/10"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
