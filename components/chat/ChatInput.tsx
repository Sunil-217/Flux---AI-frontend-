'use client';

import { useState, useRef, KeyboardEvent } from 'react';

interface Props {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = !disabled && value.trim().length > 0;

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
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

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  return (
    <div
      className={`flex items-end gap-2 rounded-[1.8rem] border bg-[var(--elevated)] backdrop-blur-xl pl-5 pr-2 py-2 transition-all duration-200 ${
        disabled
          ? 'border-[var(--line)] opacity-60'
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
        placeholder={placeholder ?? 'Message Close AI…'}
        rows={1}
        className="flex-1 resize-none bg-transparent text-[15px] text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none leading-7 py-1.5 disabled:cursor-not-allowed"
        style={{ maxHeight: '200px' }}
      />
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
