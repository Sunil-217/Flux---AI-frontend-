'use client';

import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react';
import toast from 'react-hot-toast';
import { useT } from '@/lib/i18n';

interface Props {
  onSend: (content: string, image?: string) => void;
  disabled?: boolean;
  placeholder?: string;
  isStreaming?: boolean;
  onStop?: () => void;
  injectText?: { text: string; n: number } | null;
  onUploadFiles?: (files: File[]) => void;
  onAddUrl?: () => void;
}

// File types the backend can index (used to filter folder uploads).
const ALLOWED_EXT = new Set([
  'pdf', 'docx', 'txt', 'md', 'csv', 'json', 'js', 'ts', 'jsx', 'tsx', 'py',
  'java', 'c', 'cpp', 'cs', 'go', 'rs', 'rb', 'php', 'html', 'css', 'scss',
  'sql', 'sh', 'yml', 'yaml', 'xml', 'toml',
]);

/* ── Web Speech API typings (not in standard lib.dom) ── */
interface SpeechResultAlt { transcript: string }
interface SpeechResult { 0: SpeechResultAlt; isFinal: boolean }
interface SpeechEvent { results: ArrayLike<SpeechResult> }
interface SpeechError { error: string }
interface SpeechRecognizer {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: SpeechEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: SpeechError) => void) | null;
}

function getRecognizer(): (new () => SpeechRecognizer) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognizer;
    webkitSpeechRecognition?: new () => SpeechRecognizer;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** True for image files even when the OS reports an empty/odd MIME type. */
function isImageFile(f: File): boolean {
  return f.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic|heif)$/i.test(f.name);
}

/**
 * Downscale an image to a sane size and return a data URI (keeps base64 small).
 * Bulletproof: if the canvas resize fails for ANY reason (odd format, no 2d
 * context, tainted canvas, zero-size decode), we fall back to the original
 * data URL the FileReader produced — so the preview ALWAYS shows the picked
 * photo instead of silently failing.
 */
function fileToResizedDataUrl(file: File, maxDim = 1024, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const raw = reader.result as string;
      // Small files (< 600 KB) or vector SVGs: skip the canvas entirely.
      if (!raw || file.size < 600_000 || /^data:image\/svg/i.test(raw)) {
        resolve(raw);
        return;
      }
      const img = new window.Image();
      // If decoding for resize fails, still show the original.
      img.onerror = () => resolve(raw);
      img.onload = () => {
        try {
          let { width, height } = img;
          if (!width || !height) return resolve(raw);
          const scale = Math.min(1, maxDim / Math.max(width, height));
          width = Math.round(width * scale);
          height = Math.round(height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(raw);
          ctx.drawImage(img, 0, 0, width, height);
          const out = canvas.toDataURL('image/jpeg', quality);
          resolve(out && out.length > 'data:image/jpeg;base64,'.length + 8 ? out : raw);
        } catch {
          resolve(raw);
        }
      };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}

// Slash commands — typed at the start of a message. Some expand to a fuller
// LLM prompt; the media ones (/image, /pdf) are intercepted in AppLayout
// and routed to dedicated /generate endpoints instead. /video is intentionally
// hidden from the menu: as of June 2026, every free-tier video API has moved
// behind credits (Pollinations needs Pollen, HF Inference's old URL is dead,
// CF Workers AI requires CF account). The backend route still works if the
// operator tops up credits and types /video manually.
const SLASH_COMMANDS = [
  { cmd: 'image', hint: 'Generate an image (e.g. /image a cat in a hat)' },
  { cmd: 'pdf',   hint: 'Generate a styled PDF document' },
  { cmd: 'excel', hint: 'Generate an Excel spreadsheet (.xlsx)' },
  { cmd: 'word',  hint: 'Generate a Word document (.docx)' },
  { cmd: 'ppt',   hint: 'Generate a PowerPoint presentation (.pptx)' },
  { cmd: 'research', hint: 'Deep research with sources' },
  { cmd: 'quiz',  hint: 'Quiz from your docs or last answer' },
  { cmd: 'summarize', hint: 'Summarize the conversation' },
  { cmd: 'explain', hint: 'Explain simply' },
  { cmd: 'translate', hint: 'Translate (e.g. /translate Tamil …)' },
  { cmd: 'code', hint: 'Write code for…' },
  { cmd: 'improve', hint: 'Improve & proofread' },
];

// Slash commands that bypass LLM expansion — AppLayout routes them to dedicated
// generation endpoints, so the raw `/excel foo` text must reach handleSendMessage.
const PASSTHROUGH_SLASH = new Set(['image', 'video', 'pdf', 'excel', 'word', 'ppt', 'research', 'quiz']);

function expandSlash(text: string): string {
  const m = text.match(/^\/([a-zA-Z]+)\s*([\s\S]*)$/);
  if (!m) return text;
  const cmd = m[1].toLowerCase();
  // Media commands are routed by AppLayout — pass them through unchanged.
  if (PASSTHROUGH_SLASH.has(cmd)) return text;
  const rest = m[2].trim();
  switch (cmd) {
    case 'summarize':
      return rest ? `Summarize this:\n\n${rest}` : 'Summarize our conversation so far, concisely.';
    case 'explain':
      return rest ? `Explain this clearly and simply:\n\n${rest}` : 'Explain your previous answer in simpler terms.';
    case 'translate': {
      const parts = rest.split(/\s+/).filter(Boolean);
      const lang = parts.shift() || 'English';
      const body = parts.join(' ');
      return body
        ? `Translate the following into ${lang}:\n\n${body}`
        : `Translate your previous answer into ${lang}.`;
    }
    case 'code':
      return rest ? `Write clean, working code for: ${rest}` : text;
    case 'improve':
      return rest ? `Improve and proofread this:\n\n${rest}` : 'Improve and proofread your previous answer.';
    default:
      return text;
  }
}

export function ChatInput({ onSend, disabled, placeholder, isStreaming, onStop, injectText, onUploadFiles, onAddUrl }: Props) {
  const t = useT();
  const [value, setValue] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  const baseRef = useRef('');

  useEffect(() => {
    setMicSupported(getRecognizer() !== null);
    return () => recognizerRef.current?.abort?.();
  }, []);

  // The folder picker attribute isn't in React's typings — set it imperatively.
  useEffect(() => {
    const el = folderRef.current;
    if (el) {
      el.setAttribute('webkitdirectory', '');
      el.setAttribute('directory', '');
    }
  }, []);

  // Close the attach menu on an outside click.
  useEffect(() => {
    if (!attachOpen) return;
    const onDoc = (e: globalThis.MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) setAttachOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [attachOpen]);

  // Insert text from outside (e.g. the prompt library) into the box.
  useEffect(() => {
    if (!injectText) return;
    setValue(injectText.text);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injectText]);

  const canSend = !disabled && (value.trim().length > 0 || !!image);

  const slashQuery = value.startsWith('/') && !value.includes(' ') ? value.slice(1).toLowerCase() : null;
  const slashMenu = slashQuery !== null ? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(slashQuery)) : [];

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const stopListening = () => {
    recognizerRef.current?.stop();
    setListening(false);
  };

  const handleImageFile = async (file?: File | null) => {
    if (!file || !isImageFile(file)) return;
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      if (dataUrl && dataUrl.startsWith('data:')) setImage(dataUrl);
      else toast.error('Could not load that image.');
    } catch {
      toast.error('Could not load that image.');
    }
  };

  // "Add files or photos": images attach for vision, documents go to the doc index.
  const onPickFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    arr.filter(isImageFile).forEach(handleImageFile);
    const docs = arr.filter((f) => !isImageFile(f));
    if (docs.length) onUploadFiles?.(docs);
  };

  // "Add folder": ingest every supported file inside the chosen folder.
  const onPickFolder = (files: FileList | null) => {
    if (!files || !onUploadFiles) return;
    const docs = Array.from(files).filter((f) =>
      ALLOWED_EXT.has(f.name.split('.').pop()?.toLowerCase() ?? '')
    );
    if (docs.length === 0) {
      toast.error('No supported files found in that folder.');
      return;
    }
    onUploadFiles(docs.slice(0, 20));
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const imgItem = Array.from(e.clipboardData.items).find((it) => it.type.startsWith('image/'));
    const file = imgItem?.getAsFile();
    if (file) {
      e.preventDefault();
      handleImageFile(file);
    }
  };

  const submit = () => {
    const text = value.trim();
    if ((!text && !image) || disabled) return;
    stopListening();
    onSend(expandSlash(text), image ?? undefined);
    setValue('');
    setImage(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault();
      fileRef.current?.click();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const startListening = () => {
    const Recognizer = getRecognizer();
    if (!Recognizer) {
      toast.error('Voice input is not supported in this browser.');
      return;
    }
    const rec = new Recognizer();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    baseRef.current = value ? value.trimEnd() + ' ' : '';
    rec.onresult = (e) => {
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setValue(baseRef.current + transcript);
      autoResize();
    };
    rec.onerror = (e) => {
      setListening(false);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        toast.error('Microphone permission denied.');
      }
    };
    rec.onend = () => setListening(false);
    recognizerRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const toggleMic = () => {
    if (disabled) return;
    listening ? stopListening() : startListening();
  };

  return (
    <div className="relative">
      {slashMenu.length > 0 && (
        <div className="absolute bottom-full mb-2 left-2 right-2 rounded-xl bg-[var(--elevated)] border border-[var(--line-strong)] shadow-xl overflow-hidden py-1 z-10">
          {slashMenu.map((c) => (
            <button
              key={c.cmd}
              onClick={() => {
                setValue(`/${c.cmd} `);
                textareaRef.current?.focus();
              }}
              className="flex items-center gap-2 w-full text-left px-3.5 py-2 text-sm hover:bg-[var(--fill)] transition-colors"
            >
              <span className="text-[var(--accent-fg)] font-medium">/{c.cmd}</span>
              <span className="text-[var(--ink-4)] text-xs truncate">{c.hint}</span>
            </button>
          ))}
        </div>
      )}
      <div
        className={`rounded-[1.8rem] border bg-[var(--elevated)] backdrop-blur-xl px-2 py-2 shadow-[0_6px_28px_-12px_rgba(0,0,0,0.45)] transition-all duration-200 ${
        disabled
          ? 'border-[var(--line)] opacity-60'
          : listening
          ? 'border-rose-400/70 shadow-[0_0_30px_-8px_rgba(244,63,94,0.5)]'
          : 'border-[var(--line)] focus-within:border-[var(--accent)] focus-within:shadow-[0_10px_34px_-12px_rgba(0,0,0,0.5)]'
      }`}
    >
      {/* Attached image preview */}
      {image && (
        <div className="px-2 py-1.5">
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {image ? <img src={image} alt="attachment" className="h-16 w-16 object-cover rounded-lg border border-[var(--line)]" /> : null}
            <button
              onClick={() => setImage(null)}
              aria-label="Remove image"
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--ink)] text-[var(--base)] flex items-center justify-center shadow"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-1.5 sm:gap-2">
        <input
          ref={fileRef}
          type="file"
          // Explicit image extensions first so Edge/Windows never greys them out
          // (image/* alone is sometimes mishandled by the Windows file-dialog).
          // Non-image extensions follow for document/code RAG ingestion.
          accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.avif,.svg,.heic,.heif,image/*,.pdf,.docx,.txt,.md,.csv,.json,.js,.ts,.jsx,.tsx,.py,.java,.c,.cpp,.cs,.go,.rs,.rb,.php,.html,.css,.sql,.sh,.yml,.yaml,.xml"
          multiple
          className="hidden"
          onChange={(e) => {
            onPickFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={folderRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            onPickFolder(e.target.files);
            e.target.value = '';
          }}
        />

        {/* Attach: files / photos / folder (Claude-style menu) */}
        <div ref={attachMenuRef} className="relative flex-shrink-0">
          <button
            onClick={() => !disabled && setAttachOpen((o) => !o)}
            disabled={disabled}
            aria-label="Attach"
            title="Attach files, photos, or a folder"
            className="w-9 h-9 flex items-center justify-center rounded-full text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.44 11.05l-9.19 9.19a5 5 0 01-7.07-7.07l9.19-9.19a3.5 3.5 0 014.95 4.95l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          {attachOpen && (
            <div className="absolute bottom-full mb-2 left-0 w-56 rounded-xl bg-[var(--elevated)] border border-[var(--line-strong)] shadow-xl py-1 z-20">
              <button
                onClick={() => {
                  // Open the picker FIRST (inside the user gesture), then close
                  // the menu — so the file dialog reliably appears.
                  fileRef.current?.click();
                  setAttachOpen(false);
                }}
                className="flex items-center gap-2.5 w-full text-left px-3.5 py-2 text-sm text-[var(--ink-2)] hover:bg-[var(--fill)] hover:text-[var(--ink)]"
              >
                <svg className="w-4 h-4 flex-shrink-0 text-[var(--ink-3)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2.5" />
                  <circle cx="8.5" cy="8.5" r="1.6" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-4.5-4.5L5 21.5" />
                </svg>
                <span className="flex-1">Add files or photos</span>
                <span className="text-[10px] text-[var(--ink-4)]">Ctrl+U</span>
              </button>
              <button
                onClick={() => {
                  setAttachOpen(false);
                  folderRef.current?.click();
                }}
                className="flex items-center gap-2.5 w-full text-left px-3.5 py-2 text-sm text-[var(--ink-2)] hover:bg-[var(--fill)] hover:text-[var(--ink)]"
              >
                <svg className="w-4 h-4 flex-shrink-0 text-[var(--ink-3)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                </svg>
                <span>Add folder</span>
              </button>
              {onAddUrl && (
                <button
                  onClick={() => {
                    setAttachOpen(false);
                    onAddUrl();
                  }}
                  className="flex items-center gap-2.5 w-full text-left px-3.5 py-2 text-sm text-[var(--ink-2)] hover:bg-[var(--fill)] hover:text-[var(--ink)]"
                >
                  <svg className="w-4 h-4 flex-shrink-0 text-[var(--ink-3)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5m6.828-1.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5" />
                  </svg>
                  <span>Add a link (web page)</span>
                </button>
              )}
            </div>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={autoResize}
          onPaste={onPaste}
          disabled={disabled}
          placeholder={
            listening
              ? t('Listening… speak now')
              : image
              ? 'Ask about this image…'
              : placeholder ?? t('Message Close AI…')
          }
          rows={1}
          className="flex-1 resize-none bg-transparent text-[15px] text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none leading-7 py-1.5 disabled:cursor-not-allowed min-w-0"
          style={{ maxHeight: '200px' }}
        />

        {micSupported && (
          <button
            onClick={toggleMic}
            disabled={disabled}
            aria-label={listening ? 'Stop voice input' : 'Start voice input'}
            title={listening ? 'Stop listening' : 'Speak'}
            className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
              listening ? 'bg-rose-500 text-white animate-pulse' : 'text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)]'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1.5a3 3 0 00-3 3v6a3 3 0 006 0v-6a3 3 0 00-3-3z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10.5a7 7 0 0014 0M12 17.5V21M8.5 21h7" />
            </svg>
          </button>
        )}

        {isStreaming ? (
          <button
            onClick={onStop}
            aria-label="Stop generating"
            title="Stop"
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-[var(--fill)] text-[var(--ink)] border border-[var(--line-strong)] hover:bg-[var(--fill-hover)] transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!canSend}
            aria-label="Send message"
            className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-all duration-200 ${
              canSend
                ? 'bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] text-white shadow-lg shadow-black/25 hover:scale-105 active:scale-95'
                : 'bg-[var(--fill)] text-[var(--ink-4)] cursor-not-allowed'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
    </div>
  );
}
