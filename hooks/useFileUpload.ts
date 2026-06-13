'use client';

import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { uploadFile as uploadFileApi, apiError } from '@/services/api';

// PDF, Word, Excel, PowerPoint, text/markdown/CSV/JSON, and common code files.
const ALLOWED_FILE = /\.(pdf|docx|xlsx|pptx|txt|md|csv|json|py|js|ts|tsx|jsx|html|css|java|c|cpp|h|go|rs|rb|php|sh|ya?ml|xml|sql)$/i;

export function useFileUpload(
  sessionId: string | null,
  onSuccess?: (filename: string) => void
) {
  const [isUploading, setIsUploading] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      if (!sessionId || isUploading) return;
      if (!ALLOWED_FILE.test(file.name)) {
        toast.error('Unsupported file type. Try PDF, Word, text, CSV, or a code file.');
        return;
      }

      setIsUploading(true);
      const toastId = toast.loading(`Uploading ${file.name}…`);

      try {
        const filename = await uploadFileApi(file, sessionId);
        toast.success('File uploaded — ask anything about it', { id: toastId });
        onSuccess?.(filename);
      } catch (err) {
        toast.error(apiError(err, 'Upload failed. Please try again.'), { id: toastId });
      } finally {
        setIsUploading(false);
      }
    },
    [sessionId, isUploading, onSuccess]
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
      let ok = 0;
      let lastErr: unknown = null;
      for (const file of valid) {
        try {
          const filename = await uploadFileApi(file, sessionId);
          onSuccess?.(filename);
          ok += 1;
          toast.loading(`Uploading… (${ok}/${valid.length})`, { id: toastId });
        } catch (err) {
          lastErr = err; // keep the real reason so we can surface it below
        }
      }
      if (ok > 0) toast.success(`Added ${ok} file${ok > 1 ? 's' : ''} — ask anything about them`, { id: toastId });
      // Surface the ACTUAL backend reason (e.g. "No readable text found…",
      // "Failed to index…", "File too large…") instead of a vague catch-all.
      else toast.error(apiError(lastErr, 'Could not upload those files.'), { id: toastId });
      setIsUploading(false);
    },
    [sessionId, isUploading, onSuccess]
  );

  return { isUploading, upload, uploadMany };
}
