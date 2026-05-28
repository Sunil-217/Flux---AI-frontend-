'use client';

import { useRef, useState } from 'react';
import type { DragEvent, ChangeEvent } from 'react';

interface Props {
  onUpload: (file: File) => void;
  isUploading: boolean;
  uploadedFile: string | null;
  disabled?: boolean;
}

export function FileUpload({
  onUpload,
  isUploading,
  uploadedFile,
  disabled,
}: Props) {
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
        className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-500/10 text-blue-400'
            : isDisabled
            ? 'border-zinc-800 bg-zinc-900 text-zinc-600 cursor-not-allowed'
            : uploadedFile
            ? 'border-zinc-700/50 bg-zinc-800/40 text-blue-400 hover:bg-zinc-800'
            : 'border-zinc-700/50 bg-zinc-800/40 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
        }`}
      >
        {isUploading ? (
          <>
            <svg
              className="w-3.5 h-3.5 animate-spin text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>Uploading…</span>
          </>
        ) : uploadedFile ? (
          <>
            <svg
              className="w-3.5 h-3.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="max-w-[160px] truncate">{uploadedFile}</span>
          </>
        ) : (
          <>
            <svg
              className="w-3.5 h-3.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            <span>Upload PDF</span>
          </>
        )}
      </button>
    </>
  );
}
