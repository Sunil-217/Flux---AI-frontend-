'use client';

import { useRef, useState } from 'react';
import type { DragEvent, ChangeEvent } from 'react';

interface Props {
  onUpload: (file: File) => void;
  isUploading: boolean;
  uploadedFile: string | null;
  disabled?: boolean;
}

export function FileUpload({ onUpload, isUploading, uploadedFile, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File | undefined) => {
    if (!file || file.type !== 'application/pdf') return;
    onUpload(file);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const handleDragOver = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!disabled && !isUploading) setIsDragging(true);
  };

  const isDisabled = disabled || isUploading;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleChange}
        disabled={isDisabled}
      />
      <button
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragging(false)}
        disabled={isDisabled}
        className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border transition-all ${
          isDragging
            ? 'border-violet-400/60 bg-violet-400/10 text-[var(--accent-fg)]'
            : isDisabled
            ? 'border-[var(--line)] text-[var(--ink-4)] cursor-not-allowed'
            : uploadedFile
            ? 'border-violet-400/30 bg-violet-400/10 text-[var(--accent-fg)] hover:bg-violet-400/[0.16]'
            : 'border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--fill)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]'
        }`}
      >
        {isUploading ? (
          <>
            <svg className="w-3.5 h-3.5 animate-spin text-[var(--accent-fg)]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Uploading…</span>
          </>
        ) : uploadedFile ? (
          <>
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <span className="max-w-[120px] sm:max-w-[160px] truncate">{uploadedFile}</span>
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
            <span className="hidden sm:inline">Upload PDF</span>
            <span className="sm:hidden">PDF</span>
          </>
        )}
      </button>
    </>
  );
}
