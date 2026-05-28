'use client';

import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { uploadFile as uploadFileApi } from '@/services/api';

export function useFileUpload(
  sessionId: string | null,
  onSuccess?: (filename: string) => void
) {
  const [isUploading, setIsUploading] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      if (!sessionId || isUploading) return;
      if (file.type !== 'application/pdf') {
        toast.error('Only PDF files are supported.');
        return;
      }

      setIsUploading(true);
      const toastId = toast.loading(`Uploading ${file.name}…`);

      try {
        await uploadFileApi(file, sessionId);
        toast.success('Document uploaded successfully', { id: toastId });
        onSuccess?.(file.name);
      } catch {
        toast.error('Upload failed. Please try again.', { id: toastId });
      } finally {
        setIsUploading(false);
      }
    },
    [sessionId, isUploading, onSuccess]
  );

  return { isUploading, upload };
}
