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
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
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
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  return (
    <div
      className={`flex items-end gap-3 bg-zinc-900 border rounded-xl px-4 py-3 transition-colors ${
        disabled
          ? 'border-zinc-800 opacity-60'
          : 'border-zinc-800 focus-within:border-zinc-600'
      }`}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={autoResize}
        disabled={disabled}
        placeholder={placeholder ?? 'Ask a question…'}
        rows={1}
        className="flex-1 resize-none bg-transparent text-sm text-zinc-100 placeholder-zinc-600 outline-none leading-relaxed disabled:cursor-not-allowed"
        style={{ maxHeight: '180px' }}
      />
      <button
        onClick={submit}
        disabled={!canSend}
        aria-label="Send message"
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <svg
          className="w-4 h-4 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 12h14M12 5l7 7-7 7"
          />
        </svg>
      </button>
    </div>
  );
}
