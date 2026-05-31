'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import toast from 'react-hot-toast';

interface Props {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/* ── Minimal typings for the Web Speech API (not in standard lib.dom) ── */
interface SpeechResultAlt { transcript: string }
interface SpeechResult { 0: SpeechResultAlt; isFinal: boolean }
interface SpeechEvent { results: ArrayLike<SpeechResult> }
interface SpeechError { error: string }
interface SpeechRecognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
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

export function ChatInput({ onSend, disabled, placeholder }: Props) {
  const [value, setValue] = useState('');
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  const baseRef = useRef('');

  useEffect(() => {
    setMicSupported(getRecognizer() !== null);
    return () => recognizerRef.current?.abort?.();
  }, []);

  const canSend = !disabled && value.trim().length > 0;

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

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    stopListening();
    onSend(text);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setValue(baseRef.current + transcript);
      autoResize();
    };
    rec.onerror = (e) => {
      setListening(false);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        toast.error('Microphone permission denied. Allow mic access and try again.');
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
    if (listening) stopListening();
    else startListening();
  };

  return (
    <div
      className={`flex items-end gap-1.5 sm:gap-2 rounded-[1.8rem] border bg-[var(--elevated)] backdrop-blur-xl pl-4 sm:pl-5 pr-2 py-2 transition-all duration-200 ${
        disabled
          ? 'border-[var(--line)] opacity-60'
          : listening
          ? 'border-rose-400/70 shadow-[0_0_30px_-8px_rgba(244,63,94,0.55)]'
          : 'border-[var(--line)] focus-within:border-violet-400/60 focus-within:shadow-[0_0_34px_-6px_rgba(124,108,255,0.4)]'
      }`}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={autoResize}
        disabled={disabled}
        placeholder={listening ? 'Listening… speak now' : placeholder ?? 'Message Close AI…'}
        rows={1}
        className="flex-1 resize-none bg-transparent text-[15px] text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none leading-7 py-1.5 disabled:cursor-not-allowed min-w-0"
        style={{ maxHeight: '200px' }}
      />

      {/* Mic */}
      {micSupported && (
        <button
          onClick={toggleMic}
          disabled={disabled}
          aria-label={listening ? 'Stop voice input' : 'Start voice input'}
          title={listening ? 'Stop listening' : 'Speak'}
          className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
            listening
              ? 'bg-rose-500 text-white animate-pulse'
              : 'text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)]'
          }`}
        >
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1.5a3 3 0 00-3 3v6a3 3 0 006 0v-6a3 3 0 00-3-3z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10.5a7 7 0 0014 0M12 17.5V21M8.5 21h7" />
          </svg>
        </button>
      )}

      {/* Send */}
      <button
        onClick={submit}
        disabled={!canSend}
        aria-label="Send message"
        className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-all duration-200 ${
          canSend
            ? 'bg-gradient-to-br from-[#8b7bff] to-[#6366f1] text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 active:scale-95'
            : 'bg-[var(--fill)] text-[var(--ink-4)] cursor-not-allowed'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>
    </div>
  );
}
