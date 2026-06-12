'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

/** A styled text-input dialog (replaces window.prompt). */
export function PromptModal({
  title,
  label,
  placeholder,
  initialValue = '',
  confirmLabel = 'OK',
  multiline = false,
  allowEmpty = false,
  onSubmit,
  onClose,
}: {
  title: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  multiline?: boolean;
  allowEmpty?: boolean;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = multiline ? areaRef.current : inputRef.current;
    el?.focus();
    if (!multiline) inputRef.current?.select();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, multiline]);

  const submit = () => {
    const v = value.trim();
    if (!v && !allowEmpty) return;
    onSubmit(v);
    onClose();
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className="animate-modal-in relative w-full max-w-sm rounded-2xl bg-[var(--elevated)] border border-[var(--line-strong)] shadow-2xl p-5">
        <h2 className="text-base font-semibold text-[var(--ink)]">{title}</h2>
        {label && <label className="block text-xs text-[var(--ink-3)] mt-1 mb-2">{label}</label>}
        {multiline ? (
          <textarea
            ref={areaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            rows={5}
            className={`w-full ${label ? '' : 'mt-3'} bg-[var(--fill)] border border-[var(--line)] rounded-lg px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)] transition-colors resize-none leading-relaxed`}
          />
        ) : (
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder}
            className={`w-full ${label ? '' : 'mt-3'} bg-[var(--fill)] border border-[var(--line)] rounded-lg px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)] transition-colors`}
          />
        )}
        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="text-sm font-medium text-[var(--ink-3)] hover:text-[var(--ink)] px-4 py-2 rounded-lg hover:bg-[var(--fill)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!allowEmpty && !value.trim()}
            className="text-sm font-medium rounded-lg bg-[var(--accent)] text-white px-5 py-2 hover:bg-[var(--accent-strong)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** A styled confirmation dialog (replaces window.confirm). */
export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div role="alertdialog" aria-modal="true" aria-label={title} className="animate-modal-in relative w-full max-w-sm rounded-2xl bg-[var(--elevated)] border border-[var(--line-strong)] shadow-2xl p-5">
        <h2 className="text-base font-semibold text-[var(--ink)]">{title}</h2>
        <p className="text-sm text-[var(--ink-2)] mt-2 leading-relaxed">{message}</p>
        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="text-sm font-medium text-[var(--ink-3)] hover:text-[var(--ink)] px-4 py-2 rounded-lg hover:bg-[var(--fill)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`text-sm font-medium rounded-lg px-5 py-2 text-white transition-colors ${
              danger ? 'bg-red-500 hover:bg-red-600' : 'bg-[var(--accent)] hover:bg-[var(--accent-strong)]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
