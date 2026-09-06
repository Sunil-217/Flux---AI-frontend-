'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { uploadFile as uploadFileApi, apiError } from '@/services/api';
import type { IndexingOutcome } from '@/services/api';

/**
 * The indexing lifecycle, as the client can actually observe it.
 *
 * Deliberately three phases and not five. The server does chunk, embed and
 * store — but it reports once, at the end, so a UI that animated through
 * "scanning → embedding → vectorising" would be narrating steps it cannot see.
 * `detected` (we hold the file), `indexing` (the request is in flight) and
 * `ready`/`failed` (the server answered) are the states that are true.
 */
export type ScanPhase = 'idle' | 'detected' | 'indexing' | 'ready' | 'failed';

export interface ScanState {
  phase: ScanPhase;
  filename: string;
  /** Files remaining in a multi-file upload; 0 for a single file. */
  queued: number;
  /** Chunks the server stored. Undefined unless the server said so. */
  chunks?: number;
  outcome?: IndexingOutcome;
  error?: string;
}

const IDLE: ScanState = { phase: 'idle', filename: '', queued: 0 };

/** How long a finished scan stays on screen before clearing. */
const SETTLE_MS = 2600;

// PDF, Word, Excel, PowerPoint, text/markdown/CSV/JSON, and common code files.
const ALLOWED_FILE = /\.(pdf|docx|xlsx|pptx|txt|md|csv|json|py|js|ts|tsx|jsx|html|css|java|c|cpp|h|go|rs|rb|php|sh|ya?ml|xml|sql)$/i;

export function useFileUpload(
  sessionId: string | null,
  onSuccess?: (filename: string) => void,
  /**
   * Make sure the chat exists on the server before uploading into it.
   *
   * Chat IDs are generated in the browser and the server checks ownership
   * against this user's saved blob, so a chat that has not been persisted yet
   * answers 404 "Chat not found" — which is what a fresh chat does until the
   * background save happens to have fired.
   */
  ensureSaved?: () => Promise<void>
) {
  const [isUploading, setIsUploading] = useState(false);
  const [scan, setScan] = useState<ScanState>(IDLE);
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // One timer, always cleared: a scan that finishes while another starts must
  // not have the older timeout wipe the newer state out from under it.
  const settle = useCallback((next: ScanState) => {
    if (settleRef.current) clearTimeout(settleRef.current);
    setScan(next);
    settleRef.current = setTimeout(() => setScan(IDLE), SETTLE_MS);
  }, []);

  useEffect(() => () => {
    if (settleRef.current) clearTimeout(settleRef.current);
  }, []);

  const upload = useCallback(
    async (file: File) => {
      if (!sessionId || isUploading) return;
      if (!ALLOWED_FILE.test(file.name)) {
        toast.error('Unsupported file type. Try PDF, Word, text, CSV, or a code file.');
        return;
      }

      setIsUploading(true);
      if (settleRef.current) clearTimeout(settleRef.current);
      setScan({ phase: 'detected', filename: file.name, queued: 0 });
      const toastId = toast.loading(`Uploading ${file.name}…`);

      try {
        await ensureSaved?.();
        setScan({ phase: 'indexing', filename: file.name, queued: 0 });
        const { filename, chunks, outcome } = await uploadFileApi(file, sessionId);
        settle({ phase: 'ready', filename, queued: 0, chunks, outcome });
        toast.success('File uploaded — ask anything about it', { id: toastId });
        onSuccess?.(filename);
      } catch (err) {
        const message = apiError(err, 'Upload failed. Please try again.');
        settle({ phase: 'failed', filename: file.name, queued: 0, error: message });
        toast.error(message, { id: toastId });
      } finally {
        setIsUploading(false);
      }
    },
    [sessionId, isUploading, onSuccess, ensureSaved, settle]
  );

  // Upload several files sequentially (folder / multi-select) with one toast.
  const uploadMany = useCallback(
    async (files: File[]) => {
      if (!sessionId || isUploading) return;
      const valid = files.filter((f) => ALLOWED_FILE.test(f.name));
      if (valid.length === 0) {
        toast.error('No supported files to upload.');
        return;
      }
      setIsUploading(true);
      const toastId = toast.loading(`Uploading ${valid.length} file${valid.length > 1 ? 's' : ''}…`);
      try {
        await ensureSaved?.();
      } catch {
        /* the upload below will surface the real problem */
      }
      let ok = 0;
      let lastErr: unknown = null;
      let lastResult: { chunks?: number; outcome?: IndexingOutcome } = {};
      for (const [i, file] of valid.entries()) {
        try {
          if (settleRef.current) clearTimeout(settleRef.current);
          setScan({ phase: 'indexing', filename: file.name, queued: valid.length - i - 1 });
          const { filename, chunks, outcome } = await uploadFileApi(file, sessionId);
          lastResult = { chunks, outcome };
          onSuccess?.(filename);
          ok += 1;
          toast.loading(`Uploading… (${ok}/${valid.length})`, { id: toastId });
        } catch (err) {
          lastErr = err; // keep the real reason so we can surface it below
        }
      }
      if (ok > 0) {
        settle({
          phase: 'ready',
          filename: ok === 1 ? valid[0].name : `${ok} files`,
          queued: 0,
          ...lastResult,
        });
        toast.success(`Added ${ok} file${ok > 1 ? 's' : ''} — ask anything about them`, { id: toastId });
      }
      // Surface the ACTUAL backend reason (e.g. "No readable text found…",
      // "Failed to index…", "File too large…") instead of a vague catch-all.
      else {
        const message = apiError(lastErr, 'Could not upload those files.');
        settle({ phase: 'failed', filename: `${valid.length} files`, queued: 0, error: message });
        toast.error(message, { id: toastId });
      }
      setIsUploading(false);
    },
    [sessionId, isUploading, onSuccess, ensureSaved, settle]
  );

  return { isUploading, scan, upload, uploadMany };
}
