'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ChatArea } from '@/components/chat/ChatArea';
import { CommandPalette, type PaletteAction } from '@/components/layout/CommandPalette';
import { ShortcutsModal } from '@/components/layout/ShortcutsModal';
import { PromptLibraryModal } from '@/components/layout/PromptLibraryModal';
import { AddUrlModal } from '@/components/layout/AddUrlModal';
import { ConfirmModal } from '@/components/layout/Dialogs';
import { CodeView } from '@/components/layout/CodeView';
import { useChatSessions } from '@/hooks/useChatSessions';
import { useCodeSessions } from '@/hooks/useCodeSessions';
import { useChat } from '@/hooks/useChat';
import { useFileUpload } from '@/hooks/useFileUpload';
import {
  deleteChat,
  generateTitle,
  uploadUrl,
  apiError,
  getFollowups,
  FOLDER_INSTRUCTIONS_KEY,
  generateImage,
  generateVideo,
  generatePdf,
  generateExcel,
  generateWord,
  generatePpt,
} from '@/services/api';
import type { HistoryMessage } from '@/services/api';
import { v4 as uuidv4 } from 'uuid';

/** Read a Blob into a base64 data: URI (survives reload; JSON-serializable). */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read generated file.'));
    reader.readAsDataURL(blob);
  });
}

/** Save a data: URI (or URL) to the user's device with the given filename. */
function triggerDownload(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [followups, setFollowups] = useState<string[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [promptLibOpen, setPromptLibOpen] = useState(false);
  const [addUrlOpen, setAddUrlOpen] = useState(false);
  const [mode, setMode] = useState<'chat' | 'code'>('chat');
  const [confirmClear, setConfirmClear] = useState(false);
  const [draft, setDraft] = useState<{ text: string; n: number } | null>(null);
  const prevLoading = useRef(false);

  const usePrompt = useCallback((text: string) => {
    setDraft((d) => ({ text, n: (d?.n ?? 0) + 1 }));
    setPromptLibOpen(false);
  }, []);

  const {
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    createSession,
    addMessage,
    patchMessage,
    beginVariant,
    patchVariant,
    setVariant,
    updateSession,
    addUploadedFile,
    deleteSession,
    togglePin,
    toggleArchive,
    folders,
    createFolder,
    renameFolder,
    setFolderInstructions,
    deleteFolder,
    assignFolder,
    clearAllSessions,
    deleteMessage,
    updateMessage,
  } = useChatSessions();

  // Code mode keeps its OWN session list + memory — fully separate from chat.
  const {
    codeSessions,
    activeCodeSession,
    activeCodeSessionId,
    createCodeSession,
    selectCodeSession,
    deleteCodeSession,
    renameCodeSession,
    setCodeSessionMessages,
    setCodeSessionFolder,
  } = useCodeSessions();

  const { isLoading, sendMessage, resendQuestion, regenerateVariant, stop } = useChat(
    activeSessionId,
    {
      addMessage,
      patchMessage,
      beginVariant,
      patchVariant,
      persist: (id) => updateSession(id, {}),
    }
  );

  const { isUploading, upload, uploadMany } = useFileUpload(
    activeSessionId,
    (filename) => {
      if (activeSessionId) {
        addUploadedFile(activeSessionId, filename);
      }
    }
  );

  const uploadedFile = activeSession?.uploadedFile ?? null;
  const uploadedFiles =
    activeSession?.uploadedFiles ??
    (activeSession?.uploadedFile ? [activeSession.uploadedFile] : []);

  // ── Sidebar handlers ──────────────────────────────────────────────────────
  const handleNewChat = () => {
    createSession();
    setIsSidebarOpen(false);
  };

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
    setIsSidebarOpen(false);
  };

  // Start a brand-new chat already filed inside a folder.
  const handleNewChatInFolder = useCallback(
    (folderId: string) => {
      const id = createSession();
      assignFolder(id, folderId);
      setIsSidebarOpen(false);
    },
    [createSession, assignFolder]
  );

  // Keep the active chat's folder instructions in localStorage so they're sent
  // with each message (combined with the user's global custom instructions).
  useEffect(() => {
    const fid = activeSession?.folderId;
    const instr = fid ? folders.find((f) => f.id === fid)?.instructions ?? '' : '';
    try {
      localStorage.setItem(FOLDER_INSTRUCTIONS_KEY, instr);
    } catch {
      /* ignore */
    }
  }, [activeSession?.folderId, folders]);

  const handleRenameSession = useCallback(
    (id: string, title: string) => updateSession(id, { title }),
    [updateSession]
  );

  // Chat with a web page: open a styled modal, then fetch + index the URL.
  const handleAddUrl = useCallback(() => {
    if (activeSessionId) setAddUrlOpen(true);
  }, [activeSessionId]);

  const submitUrl = useCallback(
    async (raw: string): Promise<boolean> => {
      if (!activeSessionId) return false;
      let url = raw.trim();
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      const tid = toast.loading('Reading the page…');
      try {
        const source = await uploadUrl(url, activeSessionId);
        toast.success('Page added — ask anything about it', { id: tid });
        addUploadedFile(activeSessionId, source);
        return true;
      } catch (e) {
        toast.error(apiError(e, 'Could not add that page.'), { id: tid });
        return false;
      }
    },
    [activeSessionId, addUploadedFile]
  );

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

  // Generate-slash-command handler: /image, /video, /pdf. Each adds a user
  // message + a placeholder assistant message, then patches the assistant
  // message with the generated media once the backend responds.
  const handleSlashGenerate = useCallback(
    async (
      kind: 'image' | 'video' | 'pdf' | 'excel' | 'word' | 'ppt',
      prompt: string,
      // Optional human-friendly bubble text. When the `prompt` is large (e.g. the
      // previous answer being converted to a file), we show the user's natural
      // request here instead of the raw `/excel <huge content>` payload.
      displayLabel?: string
    ) => {
      const sid = activeSessionId;
      if (!sid || !prompt.trim()) return;

      // 1. User bubble — natural request when given, else the slash form.
      addMessage(sid, {
        id: uuidv4(),
        role: 'user',
        content: (displayLabel?.trim() || `/${kind} ${prompt}`).trim(),
        timestamp: Date.now(),
      });

      // 2. Placeholder assistant message — a loading CARD (driven by `pending`)
      //    renders in ChatMessage; we patch the real media in when it arrives.
      const aId = uuidv4();
      addMessage(sid, {
        id: aId,
        role: 'assistant',
        content: '',
        pending: kind,
        imagePrompt: prompt.trim(),
        timestamp: Date.now(),
      });

      try {
        if (kind === 'image') {
          const dataUri = await generateImage(prompt.trim());
          patchMessage(sid, aId, {
            content: '',
            imageUrl: dataUri,
            imagePrompt: prompt.trim(),
            pending: undefined,
            error: false,
          });
        } else if (kind === 'video') {
          const blob = await generateVideo(prompt.trim());
          const objUrl = URL.createObjectURL(blob);
          patchMessage(sid, aId, {
            content: `**Video for:** ${prompt.trim()}`,
            videoUrl: objUrl,
            pending: undefined,
            error: false,
          });
        } else if (kind === 'pdf') {
          // Server names the file from an LLM-generated title (read from the
          // Content-Disposition header) — much nicer than slugging the prompt.
          const { blob, filename } = await generatePdf(prompt.trim());
          const dataUri = await blobToDataUrl(blob);
          patchMessage(sid, aId, {
            content: '',
            pdfUrl: dataUri,
            pdfName: filename,
            imagePrompt: prompt.trim(),
            pending: undefined,
            error: false,
          });
        } else if (kind === 'excel' || kind === 'word' || kind === 'ppt') {
          const gen = kind === 'excel' ? generateExcel : kind === 'word' ? generateWord : generatePpt;
          const { blob, filename } = await gen(prompt.trim());
          const dataUri = await blobToDataUrl(blob);
          patchMessage(sid, aId, {
            content: '',
            fileUrl: dataUri,
            fileName: filename,
            fileKind: kind,
            imagePrompt: prompt.trim(),
            pending: undefined,
            error: false,
          });
        }
      } catch (e) {
        // Keep `pending: kind` so the error card's "Try again" retries the
        // right generator (render checks `error` before `pending`).
        patchMessage(sid, aId, {
          content: apiError(e, 'please try again'),
          pending: kind,
          error: true,
          imagePrompt: prompt.trim(),
        });
      }
    },
    [activeSessionId, addMessage, patchMessage]
  );

  const handleSendMessage = useCallback(
    (content: string, image?: string) => {
      setFollowups([]);
      // Slash commands for media/document generation — intercepted BEFORE the LLM stream.
      // [\s\S] replaces dot+s flag — matches across newlines without needing ES2018.
      const slash = content.match(/^\/(image|video|pdf|excel|word|ppt)\s+([\s\S]+)/i);
      if (slash) {
        const [, kind, prompt] = slash;
        handleSlashGenerate(kind.toLowerCase() as 'image' | 'video' | 'pdf' | 'excel' | 'word' | 'ppt', prompt);
        return;
      }

      // ── Natural-language intent detection for /image and /pdf ──────────────
      // Lets the user just say "draw a dog", "make a pdf about cats", "convert
      // this to pdf", "give me a pdf of X" — no slash needed, like Claude.
      // Guarded so questions ("what is a pdf") and code ("create a function
      // returning an image") never false-fire.
      const text = content.trim();
      const startsWithSlash = text.startsWith('/');
      const looksLikeCode = /\b(function|code|class|method|api|endpoint|script|program|backend|frontend|server|route|database|sql|html|css|javascript|typescript|python|java|component|library|framework|module|import|return|variable|array|loop)\b/i.test(content);
      const tooLong = content.length > 400;
      // Questions are requests for information, not generation.
      const isQuestion =
        /^(what|how|why|when|where|who|which|whose|whom|is|are|am|was|were|can|could|would|should|shall|do|does|did|will|may|might|explain|define|describe|tell|list|name|difference|compare)\b/i.test(text) ||
        text.endsWith('?');

      // Strip verbs / media nouns / filler to reveal the explicit topic, if any.
      // Empty result ⇒ the request is contextual ("make it a pdf") and the topic
      // comes from the previous message instead.
      const extractTopic = (s: string): string =>
        s
          .replace(/\b(please|kindly|pls|can you|could you|i want|i need|i'd like|give me|make me|get me)\b/gi, ' ')
          .replace(/\b(convert|make|turn|change|save|export|download|generate|create|write|draft|build|produce|prepare|render|design|draw|sketch|illustrate|paint|show|summari[sz]e)\b/gi, ' ')
          .replace(/\b(it|this|that|these|those|the|a|an|some|my|our|your|me|us)\b/gi, ' ')
          .replace(/\b(into|onto|to|as|has|in|now|just|also|then|and|please)\b/gi, ' ')
          .replace(/\b(pdf|document|doc|report|brief|paper|file|format|version|image|picture|photo|pic|drawing|illustration|art|artwork|painting|sketch)\b/gi, ' ')
          // Office-document format nouns (so "make an excel sheet of X" → "X").
          .replace(/\b(excel|spreadsheet|xlsx|workbook|sheet|word|docx|ppt|pptx|powerpoint|presentation|slides?|deck|content|data|info|information|table)\b/gi, ' ')
          // Common Tanglish/Hinglish connecting particles that aren't topic words.
          .replace(/\b(ha|aa|da|na|naku|enaku|yenaku|venum|vendum|kudu|kodu|pannu|panni)\b/gi, ' ')
          .replace(/\b(about|on|for|of|regarding|concerning|covering|titled|called|explaining)\b/gi, ' ')
          .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
          .replace(/\s+/g, ' ')
          .trim();

      // Most-recent meaningful user message — the topic for contextual requests.
      const lastUserTopic = (): string | null => {
        const msgs = activeSession?.messages ?? [];
        for (let i = msgs.length - 1; i >= 0; i--) {
          const m = msgs[i];
          if (m.role !== 'user' || !m.content) continue;
          // Skip prior conversion-type commands so we reach the real subject.
          if (/^\s*(make it|convert|turn it|render it|now |also |as a |as an )/i.test(m.content)) continue;
          const stripped = m.content
            .replace(/^\/(image|video|pdf)\s+/i, '')
            .replace(/^\s*(?:please\s+)?(generate|create|make|draw|render|produce|design|show|sketch|illustrate|paint|write|build|draft|prepare|convert|turn|give)\s+/i, '')
            .replace(/^\s*(an?|the|some|me|us)\s+/i, '')
            .replace(/\b(image|picture|photo|pic|drawing|illustration|pdf|document|report)\b/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (stripped.length >= 2) return stripped.slice(0, 200);
        }
        return null;
      };

      // Most-recent assistant ANSWER text — the source when the user asks to turn
      // "this content" into a file. Skips empty media cards; capped so the
      // generation prompt stays within the backend's limit.
      const lastAssistantContent = (): string | null => {
        const msgs = activeSession?.messages ?? [];
        for (let i = msgs.length - 1; i >= 0; i--) {
          const m = msgs[i];
          if (m.role === 'assistant' && m.content && m.content.trim().length > 20) {
            return m.content.trim().slice(0, 7000);
          }
        }
        return null;
      };

      // True when the user refers to EXISTING content ("this content", "convert
      // this", "make it a word doc", "the table above") rather than naming a new
      // topic — then we feed the previous answer into the generator. Deliberately
      // narrow so "make an excel of this year's sales" is treated as a new topic.
      const refersToExisting =
        /\b(this|that|these|those|the)\s+(content|data|table|info|information|result|answer|reply|response|text|chart|list|numbers?|details?|output|stuff)\b/i.test(text) ||
        /\b(convert|change|turn|make|export|save|put)\s+(it|this|that|these|those)\b/i.test(text) ||
        /\b(make|turn)\s+(it|this|that)\s+(in)?to\b/i.test(text) ||
        /\b(the\s+above|above|it)\b/i.test(text);

      // Build the generation request for a document kind: convert the previous
      // answer when contextual, else use the explicit topic, else fall back.
      const frameContent = (k: 'excel' | 'word' | 'ppt' | 'pdf', body: string): string => {
        switch (k) {
          case 'excel':
            return `Convert the following content into a spreadsheet. Extract every row of tabular data into columns, preserving all values exactly — do not drop or invent rows:\n\n${body}`;
          case 'ppt':
            return `Create a clear presentation deck from the following content, organising it into logical slides with concise bullet points:\n\n${body}`;
          case 'word':
            return `Convert the following content into a polished, well-structured Word document, preserving all information, headings, and tables:\n\n${body}`;
          default: // 'pdf'
            return `Create a polished PDF document from the following content, preserving all information, headings, and tables:\n\n${body}`;
        }
      };

      const buildDocRequest = (
        k: 'excel' | 'word' | 'ppt' | 'pdf'
      ): { prompt: string; label: string } | null => {
        const explicit = extractTopic(text);
        const prior = lastAssistantContent();
        // "convert this / this content / make it a doc" → faithfully convert prior answer.
        if (refersToExisting && prior) return { prompt: frameContent(k, prior), label: text };
        // A clear new topic → generate fresh from that topic.
        if (explicit.length >= 2) return { prompt: explicit, label: text };
        // Otherwise prefer converting the previous answer, else reuse last user topic.
        if (prior) return { prompt: frameContent(k, prior), label: text };
        const lu = lastUserTopic();
        return lu ? { prompt: lu, label: text } : null;
      };

      // Shared trigger verbs (English + common Tanglish/Hinglish want/give words).
      const GEN_VERB =
        /\b(make|create|generate|build|give|want|need|get|put|convert|turn|export|prepare|save|download|venum|vendum|kudu|kodu)\b/i;

      // Does the message express a PDF / image / Excel / Word / PPT intent?
      const wantsPdf =
        /\bpdf\b/i.test(content) ||
        (/\b(make|create|write|generate|draft|build|produce|prepare|convert|turn|export|save|download)\b/i.test(content) &&
          /\b(document|report|brief|paper)\b/i.test(content));
      const wantsImage =
        /^\s*(?:please\s+)?(draw|sketch|illustrate|paint)\b/i.test(content) ||
        (/\b(make|create|generate|render|produce|design|draw|show|convert|turn|give|want)\b/i.test(content) &&
          /\b(image|picture|photo|drawing|illustration|art|artwork|painting|sketch|pic)\b/i.test(content));
      const wantsExcel =
        /\b(excel|spreadsheet|xlsx|workbook)\b/i.test(content) && GEN_VERB.test(content);
      const wantsWord =
        /\b(word\s+doc(?:ument)?|word\s+file|docx)\b/i.test(content) && GEN_VERB.test(content);
      const wantsPpt =
        /\b(ppt|pptx|powerpoint|presentation|slides?|deck)\b/i.test(content) && GEN_VERB.test(content);

      if (!startsWithSlash && !looksLikeCode && !tooLong && !isQuestion && text.length > 0) {
        // Excel/Word/PPT checked BEFORE PDF so "make an excel report" hits excel, not pdf.
        if (wantsExcel) {
          const r = buildDocRequest('excel');
          if (r) { handleSlashGenerate('excel', r.prompt, r.label); return; }
        }
        if (wantsWord) {
          const r = buildDocRequest('word');
          if (r) { handleSlashGenerate('word', r.prompt, r.label); return; }
        }
        if (wantsPpt) {
          const r = buildDocRequest('ppt');
          if (r) { handleSlashGenerate('ppt', r.prompt, r.label); return; }
        }
        if (wantsPdf) {
          const r = buildDocRequest('pdf');
          if (r) { handleSlashGenerate('pdf', r.prompt, r.label); return; }
        }
        if (wantsImage) {
          const explicit = extractTopic(text);
          const topic = explicit.length >= 2 ? explicit : lastUserTopic();
          if (topic) {
            handleSlashGenerate('image', topic);
            return;
          }
        }
      }

      const sid = activeSessionId;
      const isFirst = (activeSession?.messages.length ?? 0) === 0;
      sendMessage(content, buildHistory(), image);
      // On the very first message, ask the backend for a smart title.
      if (isFirst && sid && content.trim()) {
        generateTitle(content.trim())
          .then((t) => {
            if (t) updateSession(sid, { title: t });
          })
          .catch(() => {});
      }
    },
    [sendMessage, buildHistory, activeSessionId, activeSession, updateSession, handleSlashGenerate]
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

  // Regenerate: keep the existing reply and stream a NEW alternate variant.
  const handleRegenerate = useCallback(() => {
    if (!activeSessionId || !activeSession) return;
    setFollowups([]);
    const msgs = activeSession.messages;
    // Last assistant message (the one to add a variant to).
    let aIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'assistant') {
        aIdx = i;
        break;
      }
    }
    if (aIdx === -1) return;
    // The user message that prompted it.
    let uIdx = -1;
    for (let i = aIdx - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        uIdx = i;
        break;
      }
    }
    if (uIdx === -1) return;
    const history: HistoryMessage[] = msgs
      .slice(0, uIdx)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    regenerateVariant(msgs[aIdx].id, msgs[uIdx].content, history);
  }, [activeSessionId, activeSession, regenerateVariant]);

  const handleVariant = useCallback(
    (messageId: string, index: number) => {
      if (activeSessionId) setVariant(activeSessionId, messageId, index);
    },
    [activeSessionId, setVariant]
  );

  // Keyboard shortcuts: Ctrl/Cmd+K = palette, ? = shortcuts help, Esc = stop/close.
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (e.key === '?' && !isTyping()) {
        e.preventDefault();
        setShortcutsOpen((o) => !o);
      } else if (e.key === 'Escape') {
        if (shortcutsOpen) setShortcutsOpen(false);
        else if (isLoading) stop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isLoading, stop, shortcutsOpen]);

  const toggleTheme = useCallback(() => {
    const root = document.documentElement;
    const isLight = root.classList.contains('light');
    root.classList.remove('light', 'dark');
    root.classList.add(isLight ? 'dark' : 'light');
    try {
      localStorage.setItem('theme', isLight ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }, []);

  const paletteActions: PaletteAction[] = [
    {
      id: 'new',
      label: 'New chat',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" /></svg>
      ),
      run: handleNewChat,
    },
    {
      id: 'theme',
      label: 'Toggle light / dark theme',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
      ),
      run: toggleTheme,
    },
    {
      id: 'code',
      label: 'Code mode — open a folder',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
      ),
      run: () => setMode('code'),
    },
    {
      id: 'prompts',
      label: 'Prompt library',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 006.5 22H20V2H6.5A2.5 2.5 0 004 4.5v15z" /></svg>
      ),
      run: () => setPromptLibOpen(true),
    },
    {
      id: 'shortcuts',
      label: 'Keyboard shortcuts',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M7 10h.01M11 10h.01M15 10h.01M8 14h8" /></svg>
      ),
      run: () => setShortcutsOpen(true),
    },
    {
      id: 'clear',
      label: 'Clear all conversations',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      ),
      run: () => setConfirmClear(true),
    },
  ];

  // Clear follow-up suggestions when switching chats.
  useEffect(() => setFollowups([]), [activeSessionId]);

  // After a reply finishes, fetch follow-up question suggestions.
  useEffect(() => {
    const justFinished = prevLoading.current && !isLoading;
    prevLoading.current = isLoading;
    if (!justFinished || !activeSession) return;
    const msgs = activeSession.messages;
    const last = msgs[msgs.length - 1];
    if (!last || last.role !== 'assistant' || !last.content.trim()) return;
    const userBefore = [...msgs].slice(0, -1).reverse().find((m) => m.role === 'user');
    if (!userBefore) return;
    let cancelled = false;
    getFollowups(userBefore.content, last.content).then((qs) => {
      if (!cancelled) setFollowups(qs);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoading, activeSession]);

  return (
    <div className="flex h-screen text-[var(--ink)] overflow-hidden">
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
        onRenameSession={handleRenameSession}
        onTogglePin={togglePin}
        onToggleArchive={toggleArchive}
        folders={folders}
        onCreateFolder={createFolder}
        onRenameFolder={renameFolder}
        onSetFolderInstructions={setFolderInstructions}
        onNewChatInFolder={handleNewChatInFolder}
        onDeleteFolder={deleteFolder}
        onAssignFolder={assignFolder}
        onClearChats={clearAllSessions}
        mode={mode}
        onModeChange={setMode}
        codeSessions={codeSessions}
        activeCodeSessionId={activeCodeSessionId}
        onNewCodeChat={() => {
          createCodeSession();
          setIsSidebarOpen(false);
        }}
        onSelectCodeSession={(id) => {
          selectCodeSession(id);
          setIsSidebarOpen(false);
        }}
        onDeleteCodeSession={deleteCodeSession}
        onRenameCodeSession={renameCodeSession}
      />

      {mode === 'code' ? (
        <CodeView
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          sessionId={activeCodeSessionId ?? 'none'}
          sessionMessages={activeCodeSession?.messages ?? []}
          onMessagesChange={(msgs) => {
            if (activeCodeSessionId) setCodeSessionMessages(activeCodeSessionId, msgs);
          }}
          onNewChat={createCodeSession}
          onFolderOpened={(name) => {
            if (activeCodeSessionId) setCodeSessionFolder(activeCodeSessionId, name);
          }}
        />
      ) : (
        <ChatArea
          session={activeSession}
          isLoading={isLoading}
          isUploading={isUploading}
          uploadedFile={uploadedFile}
          uploadedFiles={uploadedFiles}
          onSendMessage={handleSendMessage}
          onUploadFile={upload}
          onUploadFiles={uploadMany}
          onNewChat={handleNewChat}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onStop={stop}
          onRegenerate={handleRegenerate}
          onRegenerateMedia={handleSlashGenerate}
          onVariant={handleVariant}
          onAddUrl={handleAddUrl}
          followups={followups}
          onPickFollowup={handleSendMessage}
          injectText={draft}
        />
      )}

      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          sessions={sessions}
          onSelectSession={handleSelectSession}
          actions={paletteActions}
        />
      )}

      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}

      {promptLibOpen && (
        <PromptLibraryModal onClose={() => setPromptLibOpen(false)} onUse={usePrompt} />
      )}

      {addUrlOpen && <AddUrlModal onClose={() => setAddUrlOpen(false)} onSubmit={submitUrl} />}

      {confirmClear && (
        <ConfirmModal
          title="Clear all conversations"
          message="Delete ALL conversations? This permanently removes every chat and can't be undone."
          confirmLabel="Delete all"
          danger
          onConfirm={clearAllSessions}
          onClose={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}
