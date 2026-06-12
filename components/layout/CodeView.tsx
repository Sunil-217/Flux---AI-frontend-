'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { editCodeFile, agentPlan, answerCodeQuestion, type CodeContextFile, type CodeTurn } from '@/services/api';
import {
  fsSupported,
  pickDirectory,
  listCodeFiles,
  readFileText,
  writeFileText,
  createFile,
  deleteFile,
  renameFile,
  searchInFiles,
  type CodeFileEntry,
  type SearchHit,
} from '@/lib/fsAccess';
import { CodeMirrorEditor } from '@/components/code/CodeMirrorEditor';
import { DiffViewer } from '@/components/code/DiffViewer';
import { langLabel } from '@/components/code/cmLang';
import { PromptModal, ConfirmModal } from '@/components/layout/Dialogs';
import type { CodeChatMessage, CodeStep } from '@/types';

type StepStatus = CodeStep['status'];
type Step = CodeStep;
type ChatMsg = CodeChatMessage;
interface Proposal {
  original: string;
  newContent: string;
  isNew: boolean;
}

/** Track the app's light/dark theme (toggled as a class on <html>). */
function useAppTheme(): 'dark' | 'light' {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(() => {
    const read = () =>
      setTheme(document.documentElement.classList.contains('light') ? 'light' : 'dark');
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return theme;
}

function Markdown({ children }: { children: string }) {
  return (
    <div className="cm-md text-[13px] leading-relaxed text-[var(--ink-2)] [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2 [&_li]:mb-0.5 [&_pre]:my-2 [&_pre]:p-2.5 [&_pre]:rounded-lg [&_pre]:bg-[var(--fill)] [&_pre]:overflow-auto [&_pre]:text-[12px] [&_code]:font-mono [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h1]:text-[var(--ink)] [&_h2]:text-[var(--ink)] [&_h3]:text-[var(--ink)] [&_strong]:text-[var(--ink)] [&_strong]:font-semibold [&_a]:text-[var(--accent-fg)]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'running')
    return <span className="w-3 h-3 rounded-full border-2 border-[var(--line-strong)] border-t-[var(--accent)] animate-spin flex-shrink-0" />;
  if (status === 'done')
    return (
      <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
    );
  if (status === 'failed' || status === 'skipped')
    return (
      <svg className="w-3.5 h-3.5 text-[var(--ink-4)] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
    );
  return <span className="w-3 h-3 rounded-full border border-[var(--line-strong)] flex-shrink-0" />;
}

export function CodeView({
  onToggleSidebar,
  sessionId,
  sessionMessages,
  onMessagesChange,
  onNewChat,
  onFolderOpened,
}: {
  onToggleSidebar: () => void;
  sessionId: string;
  sessionMessages: ChatMsg[];
  onMessagesChange: (msgs: ChatMsg[]) => void;
  onNewChat: () => void;
  onFolderOpened: (name: string) => void;
}) {
  const theme = useAppTheme();
  const [supported, setSupported] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dir, setDir] = useState<any>(null);
  const [folderName, setFolderName] = useState('');
  const [files, setFiles] = useState<CodeFileEntry[]>([]);
  const [loadingFolder, setLoadingFolder] = useState(false);

  // Left panel: file browser vs project search.
  const [leftTab, setLeftTab] = useState<'files' | 'search'>('files');
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  // Open editor tabs + per-file content/dirty/diff state.
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [proposals, setProposals] = useState<Record<string, Proposal>>({});
  const [showDiff, setShowDiff] = useState<Record<string, boolean>>({});

  // Agentic chat — seeded from the active Code session (memory lives in the
  // session store, isolated from Chat mode).
  const [messages, setMessages] = useState<ChatMsg[]>(sessionMessages);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const msgId = useRef(sessionMessages.reduce((mx, m) => Math.max(mx, m.id), 0) + 1);
  const chatEndRef = useRef<HTMLDivElement>(null);
  // Each code chat remembers its own folder handle (in-memory, this page load) so
  // switching chats restores that chat's workspace — like Claude Code per-project.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dirHandlesRef = useRef<Map<string, any>>(new Map());

  // Quick-open (Ctrl/Cmd+P) palette.
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');

  // Themed dialogs for file operations (no native window.prompt/confirm).
  const [promptCfg, setPromptCfg] = useState<{
    title: string;
    placeholder?: string;
    initialValue?: string;
    onSubmit: (v: string) => void;
  } | null>(null);
  const [confirmCfg, setConfirmCfg] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => setSupported(fsSupported()), []);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  // Switching to a different code chat → load THAT chat's conversation and restore
  // (or clear) its own folder workspace. A new chat with no folder shows the
  // "Open folder" picker; an existing chat reopens the folder it was using.
  useEffect(() => {
    setMessages(sessionMessages);
    msgId.current = sessionMessages.reduce((mx, m) => Math.max(mx, m.id), 0) + 1;
    // reset editor workspace for the switch
    setOpenTabs([]);
    setActiveTab(null);
    setFileContents({});
    setDirty({});
    setProposals({});
    setShowDiff({});
    setQuery('');
    setSearchQuery('');
    setSearchHits([]);
    // restore this chat's folder if we still hold its handle (this page load)
    const handle = dirHandlesRef.current.get(sessionId);
    if (handle) {
      setDir(handle);
      setFolderName(handle.name || 'folder');
      listCodeFiles(handle)
        .then(setFiles)
        .catch(() => setFiles([]));
    } else {
      setDir(null);
      setFolderName('');
      setFiles([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Push every change back up to the session store (the single source of truth /
  // persistence). Deps intentionally exclude onMessagesChange to avoid re-firing.
  useEffect(() => {
    onMessagesChange(messages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const activeProposal = activeTab ? proposals[activeTab] : undefined;
  const activeText = activeTab
    ? activeProposal
      ? activeProposal.newContent
      : fileContents[activeTab] ?? ''
    : '';
  const proposalPaths = Object.keys(proposals);

  // ── Folder ──────────────────────────────────────────────────────────────
  const openFolder = async () => {
    const handle = await pickDirectory();
    if (!handle) return;
    setLoadingFolder(true);
    try {
      setDir(handle);
      dirHandlesRef.current.set(sessionId, handle); // remember folder for THIS chat
      const name = handle.name || 'folder';
      setFolderName(name);
      const list = await listCodeFiles(handle);
      setFiles(list);
      setOpenTabs([]);
      setActiveTab(null);
      setFileContents({});
      setDirty({});
      setProposals({});
      setShowDiff({});
      onFolderOpened(name); // record the folder on this code chat
      pushAssistant(
        `Opened **${name}** · ${list.length} files. Tell me what to build, change, or explain.`
      );
    } catch {
      toast.error('Could not read that folder.');
    } finally {
      setLoadingFolder(false);
    }
  };

  // ── Tabs / opening files ─────────────────────────────────────────────────
  const openFile = useCallback(
    async (path: string) => {
      if (!dir) return;
      setOpenTabs((t) => (t.includes(path) ? t : [...t, path]));
      setActiveTab(path);
      if (proposals[path]) return; // proposal content already in memory
      if (fileContents[path] == null) {
        try {
          const txt = await readFileText(dir, path);
          setFileContents((c) => ({ ...c, [path]: txt }));
        } catch (e) {
          toast.error((e as Error)?.message || 'Could not open that file.');
        }
      }
    },
    [dir, proposals, fileContents]
  );

  const closeTab = (path: string) => {
    setOpenTabs((tabs) => {
      const next = tabs.filter((t) => t !== path);
      if (activeTab === path) setActiveTab(next.length ? next[next.length - 1] : null);
      return next;
    });
  };

  const onEditorChange = (val: string) => {
    if (!activeTab) return;
    if (proposals[activeTab]) {
      setProposals((p) => ({ ...p, [activeTab]: { ...p[activeTab], newContent: val } }));
    } else {
      setFileContents((c) => ({ ...c, [activeTab]: val }));
      setDirty((d) => ({ ...d, [activeTab]: true }));
    }
  };

  // ── Save / accept / reject ────────────────────────────────────────────────
  const save = useCallback(async () => {
    if (!dir || !activeTab || proposals[activeTab]) return;
    if (!dirty[activeTab]) return;
    try {
      await writeFileText(dir, activeTab, fileContents[activeTab] ?? '');
      setDirty((d) => ({ ...d, [activeTab]: false }));
      toast.success(`Saved ${activeTab.split('/').pop()}`);
    } catch {
      toast.error('Could not write the file (permission?).');
    }
  }, [dir, activeTab, proposals, dirty, fileContents]);

  const acceptProposal = async (path: string) => {
    const p = proposals[path];
    if (!dir || !p) return;
    try {
      await writeFileText(dir, path, p.newContent);
      setFileContents((c) => ({ ...c, [path]: p.newContent }));
      setProposals((prev) => {
        const n = { ...prev };
        delete n[path];
        return n;
      });
      setDirty((d) => ({ ...d, [path]: false }));
      if (p.isNew) setFiles(await listCodeFiles(dir));
      toast.success(`Applied ${path.split('/').pop()}`);
    } catch {
      toast.error('Could not write the file (permission?).');
    }
  };

  const rejectProposal = (path: string) => {
    const p = proposals[path];
    setProposals((prev) => {
      const n = { ...prev };
      delete n[path];
      return n;
    });
    if (p?.isNew) closeTab(path);
  };

  const acceptAll = async () => {
    for (const p of Object.keys(proposals)) {
      // eslint-disable-next-line no-await-in-loop
      await acceptProposal(p);
    }
  };

  // Start a brand-new code chat (its own separate memory, via the session store).
  const newChat = () => onNewChat();

  // ── File operations ────────────────────────────────────────────────────────
  const newFile = () => {
    if (!dir) return;
    setPromptCfg({
      title: 'New file',
      placeholder: 'path/to/file.ts (relative to the project root)',
      onSubmit: async (raw) => {
        const path = raw.trim();
        if (!path) return;
        try {
          await createFile(dir, path);
          setFiles(await listCodeFiles(dir));
          openFile(path);
          toast.success('File created');
        } catch (e) {
          toast.error((e as Error)?.message || 'Could not create the file.');
        }
      },
    });
  };

  const removeFile = (path: string) => {
    if (!dir) return;
    setConfirmCfg({
      title: 'Delete file',
      message: `Delete ${path}? This permanently removes it from disk and can't be undone.`,
      onConfirm: async () => {
        try {
          await deleteFile(dir, path);
          closeTab(path);
          setFileContents((c) => {
            const n = { ...c };
            delete n[path];
            return n;
          });
          setFiles(await listCodeFiles(dir));
          toast.success('File deleted');
        } catch {
          toast.error('Could not delete the file.');
        }
      },
    });
  };

  const doRename = (path: string) => {
    if (!dir) return;
    setPromptCfg({
      title: 'Rename / move file',
      placeholder: 'new/relative/path',
      initialValue: path,
      onSubmit: async (raw) => {
        const target = raw.trim();
        if (!target || target === path) return;
        try {
          await renameFile(dir, path, target);
          setOpenTabs((t) => t.map((x) => (x === path ? target : x)));
          setActiveTab((a) => (a === path ? target : a));
          setFileContents((c) => {
            const n = { ...c };
            if (n[path] != null) {
              n[target] = n[path];
              delete n[path];
            }
            return n;
          });
          setFiles(await listCodeFiles(dir));
          toast.success('Renamed');
        } catch (e) {
          toast.error((e as Error)?.message || 'Could not rename.');
        }
      },
    });
  };

  // ── Project search ──────────────────────────────────────────────────────────
  const runSearch = async () => {
    if (!dir || !searchQuery.trim()) return;
    setSearching(true);
    try {
      setSearchHits(await searchInFiles(dir, searchQuery, files));
    } catch {
      toast.error('Search failed.');
    } finally {
      setSearching(false);
    }
  };

  // ── Agentic chat ───────────────────────────────────────────────────────────
  const pushUser = (text: string) =>
    setMessages((m) => [...m, { id: msgId.current++, role: 'user', text }]);
  const pushAssistant = (text: string, fileChips?: string[]) =>
    setMessages((m) => [...m, { id: msgId.current++, role: 'assistant', text, files: fileChips }]);
  const pushPlan = (text: string, steps: Step[]) => {
    const id = msgId.current++;
    setMessages((m) => [...m, { id, role: 'assistant', text, steps }]);
    return id;
  };
  const setStep = (id: number, idx: number, status: StepStatus) =>
    setMessages((ms) =>
      ms.map((m) =>
        m.id === id && m.steps ? { ...m, steps: m.steps.map((s, i) => (i === idx ? { ...s, status } : s)) } : m
      )
    );

  const readContext = async (paths: string[]): Promise<CodeContextFile[]> => {
    const out: CodeContextFile[] = [];
    for (const p of paths.slice(0, 8)) {
      try {
        // eslint-disable-next-line no-await-in-loop
        out.push({ path: p, content: await readFileText(dir, p) });
      } catch {
        /* skip unreadable/oversized */
      }
    }
    return out;
  };

  const send = async () => {
    const text = input.trim();
    if (!dir || !text || busy) return;
    // Memory: recent turns of THIS project's conversation, captured before we add
    // the new message — lets the agent resolve "it"/"that" across requests.
    const history: CodeTurn[] = messages
      .filter((m) => m.text && m.text.trim())
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.text.slice(0, 1500) }));
    setInput('');
    pushUser(text);
    setBusy(true);
    try {
      const task = activeTab ? `${text}\n\n(The user currently has ${activeTab} open.)` : text;
      const plan = await agentPlan(files.map((f) => f.path), task, history);

      // ── Answer mode: explain / find / review — no edits ──
      if (plan.mode === 'answer') {
        const ctx = await readContext(plan.files.map((f) => f.path));
        const answer = await answerCodeQuestion(text, ctx, history);
        pushAssistant(
          answer ||
            "I couldn't find that in the project files. Tell me which file or feature to look at."
        );
        return;
      }

      // ── Edit mode ──
      if (!plan.files.length) {
        pushAssistant(
          "I couldn't identify files to change. Try naming a file or feature (e.g. \"add a logout button to the navbar\")."
        );
        return;
      }

      const steps: Step[] = plan.files.map((f) => ({
        path: f.path,
        action: f.action,
        reason: f.reason,
        status: 'queued',
      }));
      const planId = pushPlan(plan.notes || `Editing ${steps.length} file(s)…`, steps);

      const produced: Record<string, Proposal> = {};
      for (let i = 0; i < plan.files.length; i++) {
        const step = plan.files[i];
        setStep(planId, i, 'running');
        let original = '';
        let isNew = step.action === 'create';
        try {
          // eslint-disable-next-line no-await-in-loop
          original = await readFileText(dir, step.path);
        } catch (e) {
          if (String((e as Error)?.message).includes('too large')) {
            setStep(planId, i, 'skipped');
            continue;
          }
          isNew = true;
          original = '';
        }
        let newContent = '';
        try {
          // eslint-disable-next-line no-await-in-loop
          newContent = await editCodeFile(step.path, original, task, history);
        } catch {
          newContent = '';
        }
        if (newContent && newContent.trim() && newContent !== original) {
          produced[step.path] = { original, newContent, isNew };
          setStep(planId, i, 'done');
        } else {
          setStep(planId, i, 'failed');
        }
      }

      const changed = Object.keys(produced);
      if (changed.length) {
        setProposals((prev) => ({ ...prev, ...produced }));
        setShowDiff((prev) => {
          const n = { ...prev };
          changed.forEach((p) => (n[p] = true));
          return n;
        });
        pushAssistant(
          `Proposed changes to **${changed.length} file${changed.length > 1 ? 's' : ''}**. Review the diff and **Accept** or **Reject** each — nothing is written until you accept.`,
          changed
        );
        openFile(changed[0]);
      } else {
        pushAssistant('No changes were produced. Try rephrasing the request.');
      }
    } catch {
      pushAssistant('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // ── Keyboard: Ctrl/Cmd+S save, Ctrl/Cmd+P quick-open ──
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (!dir) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveRef.current();
      } else if (mod && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setQuickQuery('');
        setQuickOpen(true);
      } else if (e.key === 'Escape') {
        setQuickOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dir]);

  // Combined tree: real files + any not-yet-saved new-file proposals.
  const newProposalFiles = proposalPaths.filter((p) => !files.some((f) => f.path === p));
  const allPaths = [...files.map((f) => f.path), ...newProposalFiles];
  const shownPaths = (query.trim()
    ? allPaths.filter((p) => p.toLowerCase().includes(query.trim().toLowerCase()))
    : allPaths
  ).sort((a, b) => a.localeCompare(b));

  const quickPaths = quickQuery.trim()
    ? allPaths.filter((p) => p.toLowerCase().includes(quickQuery.trim().toLowerCase())).slice(0, 40)
    : allPaths.slice(0, 40);

  return (
    <main className="relative flex-1 flex flex-col h-full min-w-0 overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-2 px-3 sm:px-4 h-14 flex-shrink-0 border-b border-[var(--line)] bg-[var(--panel)]">
        <button
          onClick={onToggleSidebar}
          className="md:hidden flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors"
          aria-label="Toggle sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <svg className="w-4.5 h-4.5 text-[var(--accent-fg)] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
        <h1 className="text-sm font-semibold text-[var(--ink)] truncate">
          Code mode {folderName && <span className="text-[var(--ink-3)] font-normal">· {folderName}</span>}
        </h1>
        {dir && (
          <span className="hidden sm:inline text-[10px] text-[var(--ink-4)] ml-auto">
            ⌘/Ctrl+P open · ⌘/Ctrl+S save
          </span>
        )}
      </header>

      {!supported ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <p className="text-sm text-[var(--ink-2)]">Folder access needs <strong>Chrome</strong> or <strong>Edge</strong>.</p>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          {dir ? (
          <>
          {/* LEFT — file tree / search */}
          <div className="w-56 flex-shrink-0 border-r border-[var(--line)] flex flex-col min-h-0">
            <div className="flex items-center border-b border-[var(--line)] text-xs">
              <button
                onClick={() => setLeftTab('files')}
                className={`flex-1 py-2 font-medium transition-colors ${leftTab === 'files' ? 'text-[var(--ink)] border-b-2 border-[var(--accent)]' : 'text-[var(--ink-4)] hover:text-[var(--ink-2)]'}`}
              >
                Files
              </button>
              <button
                onClick={() => setLeftTab('search')}
                className={`flex-1 py-2 font-medium transition-colors ${leftTab === 'search' ? 'text-[var(--ink)] border-b-2 border-[var(--accent)]' : 'text-[var(--ink-4)] hover:text-[var(--ink-2)]'}`}
              >
                Search
              </button>
            </div>

            {leftTab === 'files' ? (
              <>
                <div className="p-2 border-b border-[var(--line)] flex items-center gap-1.5">
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter files…" className="flex-1 min-w-0 bg-[var(--fill)] border border-[var(--line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)]" />
                  <button onClick={newFile} title="New file" className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  </button>
                  <button onClick={openFolder} title="Open another folder" className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto py-1">
                  {shownPaths.map((path) => {
                    const isNew = newProposalFiles.includes(path);
                    return (
                      <div key={path} className={`group/row flex items-center gap-1.5 w-full px-2 py-1.5 text-xs transition-colors ${activeTab === path ? 'bg-[var(--fill-strong)]' : 'hover:bg-[var(--fill)]'}`}>
                        <button onClick={() => openFile(path)} title={path} className={`flex items-center gap-1.5 flex-1 min-w-0 text-left truncate ${activeTab === path ? 'text-[var(--ink)]' : 'text-[var(--ink-3)] group-hover/row:text-[var(--ink-2)]'}`}>
                          {proposals[path] && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] flex-shrink-0" title="Proposed changes" />}
                          <span className="truncate">{path}</span>
                          {isNew && <span className="text-[9px] text-emerald-400 flex-shrink-0">new</span>}
                        </button>
                        {!isNew && (
                          <span className="hidden group-hover/row:flex items-center gap-0.5 flex-shrink-0">
                            <button onClick={() => doRename(path)} title="Rename" className="w-5 h-5 flex items-center justify-center rounded text-[var(--ink-4)] hover:text-[var(--ink)]">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button onClick={() => removeFile(path)} title="Delete" className="w-5 h-5 flex items-center justify-center rounded text-[var(--ink-4)] hover:text-red-400">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="px-3 py-2 border-t border-[var(--line)] text-[10px] text-[var(--ink-4)]">{files.length} files{proposalPaths.length > 0 && ` · ${proposalPaths.length} changed`}</div>
              </>
            ) : (
              <>
                <div className="p-2 border-b border-[var(--line)] flex items-center gap-1.5">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                    placeholder="Search in files…"
                    className="flex-1 min-w-0 bg-[var(--fill)] border border-[var(--line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)]"
                  />
                  <button onClick={runSearch} title="Search" className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" /></svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto py-1">
                  {searching && <div className="px-3 py-2 text-xs text-[var(--ink-4)]">Searching…</div>}
                  {!searching && searchHits.length === 0 && searchQuery && <div className="px-3 py-2 text-xs text-[var(--ink-4)]">No matches.</div>}
                  {searchHits.map((h, i) => (
                    <button key={`${h.path}:${h.line}:${i}`} onClick={() => openFile(h.path)} className="block w-full text-left px-3 py-1.5 hover:bg-[var(--fill)] group/hit">
                      <div className="flex items-center gap-1.5 text-[11px] text-[var(--ink-3)] group-hover/hit:text-[var(--ink-2)]">
                        <span className="truncate">{h.path.split('/').pop()}</span>
                        <span className="text-[var(--ink-4)] flex-shrink-0">:{h.line}</span>
                      </div>
                      <div className="text-[11px] font-mono text-[var(--ink-4)] truncate">{h.text}</div>
                    </button>
                  ))}
                </div>
                {searchHits.length > 0 && <div className="px-3 py-2 border-t border-[var(--line)] text-[10px] text-[var(--ink-4)]">{searchHits.length} matches</div>}
              </>
            )}
          </div>

          {/* MIDDLE — tabs + editor / diff */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-[var(--line)]">
            {openTabs.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-sm text-[var(--ink-4)] px-6 text-center">
                Open a file from the left, or ask the agent on the right →
              </div>
            ) : (
              <>
                {/* Tab strip */}
                <div className="flex items-stretch border-b border-[var(--line)] overflow-x-auto bg-[var(--panel)]">
                  {openTabs.map((path) => (
                    <div
                      key={path}
                      onClick={() => setActiveTab(path)}
                      className={`group/tab flex items-center gap-1.5 pl-3 pr-1.5 py-2 text-xs border-r border-[var(--line)] cursor-pointer whitespace-nowrap transition-colors ${activeTab === path ? 'bg-[var(--base)] text-[var(--ink)]' : 'text-[var(--ink-3)] hover:bg-[var(--fill)]'}`}
                    >
                      {proposals[path] && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" title="Proposed changes" />}
                      <span className="font-mono">{path.split('/').pop()}</span>
                      {dirty[path] && !proposals[path] && <span className="text-[var(--accent-fg)]" title="Unsaved">●</span>}
                      <button onClick={(e) => { e.stopPropagation(); closeTab(path); }} className="w-4 h-4 flex items-center justify-center rounded hover:bg-[var(--fill-strong)] text-[var(--ink-4)] hover:text-[var(--ink)] opacity-0 group-hover/tab:opacity-100">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Action bar for the active file */}
                {activeTab && (
                  <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-[var(--line)] bg-[var(--panel)]">
                    <span className="text-[11px] font-mono text-[var(--ink-3)] truncate flex items-center gap-2">
                      {activeTab}
                      <span className="text-[var(--ink-4)] not-italic">· {langLabel(activeTab)}</span>
                    </span>
                    {activeProposal ? (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className="flex rounded-lg border border-[var(--line)] overflow-hidden text-[11px]">
                          <button onClick={() => setShowDiff((s) => ({ ...s, [activeTab]: true }))} className={`px-2 py-1 ${showDiff[activeTab] ? 'bg-[var(--fill-strong)] text-[var(--ink)]' : 'text-[var(--ink-3)] hover:text-[var(--ink)]'}`}>Diff</button>
                          <button onClick={() => setShowDiff((s) => ({ ...s, [activeTab]: false }))} className={`px-2 py-1 ${!showDiff[activeTab] ? 'bg-[var(--fill-strong)] text-[var(--ink)]' : 'text-[var(--ink-3)] hover:text-[var(--ink)]'}`}>Edit</button>
                        </div>
                        <button onClick={() => rejectProposal(activeTab)} className="text-[11px] font-medium rounded-lg border border-[var(--line)] text-[var(--ink-3)] px-2.5 py-1 hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors">Reject</button>
                        <button onClick={() => acceptProposal(activeTab)} className="text-[11px] font-medium rounded-lg bg-emerald-600 text-white px-2.5 py-1 hover:bg-emerald-500 transition-colors">Accept</button>
                      </div>
                    ) : (
                      <button onClick={save} disabled={!dirty[activeTab]} className="text-[11px] font-medium rounded-lg bg-[var(--accent)] text-white px-3 py-1 hover:bg-[var(--accent-strong)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Save</button>
                    )}
                  </div>
                )}

                {/* Editor / diff body */}
                <div className="flex-1 min-h-0 overflow-hidden bg-[var(--base)]">
                  {activeTab && activeProposal && showDiff[activeTab] ? (
                    <DiffViewer original={activeProposal.original} modified={activeProposal.newContent} path={activeTab} theme={theme} />
                  ) : activeTab ? (
                    <CodeMirrorEditor value={activeText} onChange={onEditorChange} path={activeTab} theme={theme} />
                  ) : null}
                </div>
              </>
            )}
          </div>
          </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8 border-r border-[var(--line)]">
              <p className="text-sm text-[var(--ink-2)] mb-1">Open a project folder for this chat.</p>
              <p className="text-xs text-[var(--ink-4)] mb-5 max-w-sm">
                Each code chat has its own folder + memory (like Claude Code). The agent plans, edits,
                and you accept the diffs. Terminal commands aren&apos;t available in a browser.
              </p>
              <button onClick={openFolder} disabled={loadingFolder} className="inline-flex items-center gap-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white px-5 py-2.5 hover:bg-[var(--accent-strong)] disabled:opacity-50 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                {loadingFolder ? 'Reading…' : 'Open folder'}
              </button>
            </div>
          )}

          {/* RIGHT — AI agent chat (always visible so each chat's conversation shows) */}
          <div className="w-80 flex-shrink-0 flex flex-col min-h-0">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--line)]">
              <span className="text-xs font-medium text-[var(--ink-2)]">Agent</span>
              <div className="flex items-center gap-1.5">
                {proposalPaths.length > 0 && (
                  <button onClick={acceptAll} className="text-[11px] font-medium rounded-lg bg-emerald-600 text-white px-2.5 py-1 hover:bg-emerald-500 transition-colors">
                    Accept all ({proposalPaths.length})
                  </button>
                )}
                <button onClick={newChat} title="New code chat (its own folder + memory)" className="text-[11px] font-medium rounded-lg border border-[var(--line)] text-[var(--ink-3)] px-2 py-1 hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors">
                  New chat
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.map((m) => (
                <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : ''}>
                  <div className={`text-[13px] leading-relaxed rounded-xl px-3 py-2 ${m.role === 'user' ? 'bg-[var(--fill-strong)] text-[var(--ink)] max-w-[85%]' : 'text-[var(--ink-2)] w-full'}`}>
                    {m.role === 'assistant' ? <Markdown>{m.text}</Markdown> : m.text}

                    {/* Live plan steps */}
                    {m.steps && m.steps.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {m.steps.map((s, i) => (
                          <div key={`${s.path}-${i}`} className="flex items-start gap-2">
                            <span className="mt-0.5"><StepIcon status={s.status} /></span>
                            <div className="min-w-0 flex-1">
                              <button onClick={() => openFile(s.path)} className="text-[12px] font-mono text-[var(--ink-2)] hover:text-[var(--ink)] truncate block text-left">
                                {s.action === 'create' ? '+ ' : ''}{s.path}
                              </button>
                              {s.reason && <div className="text-[11px] text-[var(--ink-4)] truncate">{s.reason}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Review chips */}
                    {m.files && m.files.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {m.files.map((p) => (
                          <button key={p} onClick={() => openFile(p)} className="inline-flex items-center gap-1 text-[11px] font-mono rounded-md px-2 py-0.5 border border-[var(--line)] bg-[var(--fill)] hover:bg-[var(--fill-hover)] text-[var(--ink-2)]">
                            {proposals[p] && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />}
                            {p.split('/').pop()}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex items-center gap-2 text-xs text-[var(--ink-3)]">
                  <span className="w-3 h-3 rounded-full border-2 border-[var(--line-strong)] border-t-[var(--accent)] animate-spin" />
                  Working…
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="border-t border-[var(--line)] p-2.5">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  disabled={busy || !dir}
                  rows={1}
                  placeholder={dir ? 'Ask to build, change, or explain…' : 'Open a folder to start…'}
                  className="flex-1 resize-none bg-[var(--fill)] border border-[var(--line)] rounded-xl px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)] disabled:opacity-60 max-h-28"
                />
                <button onClick={send} disabled={busy || !input.trim() || !dir} className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M12 19V5M5 12l7-7 7 7" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick-open palette (Ctrl/Cmd+P) */}
      {quickOpen && dir && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center pt-24 bg-black/40" onClick={() => setQuickOpen(false)}>
          <div className="w-full max-w-lg mx-4 rounded-xl border border-[var(--line-strong)] bg-[var(--elevated)] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={quickQuery}
              onChange={(e) => setQuickQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && quickPaths[0]) {
                  openFile(quickPaths[0]);
                  setQuickOpen(false);
                } else if (e.key === 'Escape') setQuickOpen(false);
              }}
              placeholder="Go to file…"
              className="w-full bg-transparent px-4 py-3 text-sm text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none border-b border-[var(--line)]"
            />
            <div className="max-h-72 overflow-y-auto py-1">
              {quickPaths.map((p) => (
                <button key={p} onClick={() => { openFile(p); setQuickOpen(false); }} className="flex items-center gap-2 w-full text-left px-4 py-1.5 text-xs text-[var(--ink-3)] hover:bg-[var(--fill)] hover:text-[var(--ink)]">
                  <span className="font-mono truncate">{p}</span>
                </button>
              ))}
              {quickPaths.length === 0 && <div className="px-4 py-3 text-xs text-[var(--ink-4)]">No matching files.</div>}
            </div>
          </div>
        </div>
      )}

      {promptCfg && (
        <PromptModal
          title={promptCfg.title}
          placeholder={promptCfg.placeholder}
          initialValue={promptCfg.initialValue}
          confirmLabel={promptCfg.initialValue ? 'Save' : 'Create'}
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
    </main>
  );
}
