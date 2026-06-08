export interface Source {
  page?: number;
  content?: string;
  source?: string;
  metadata?: { filename?: string; page?: number; [k: string]: unknown };
  [key: string]: unknown;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sources?: Source[];
  image?: string; // base64 data URI (user image/screenshot attachment)
  imageUrl?: string; // generated image data URI (assistant message via /image)
  imagePrompt?: string; // the prompt used to generate imageUrl (for re-gen / alt text)
  videoUrl?: string; // generated video URL (assistant message via /video)
  pdfUrl?: string; // generated PDF data URI (assistant message via /pdf)
  pdfName?: string; // download filename for pdfUrl
  fileUrl?: string; // generated file data URI (Excel / Word / PPT)
  fileName?: string; // download filename for fileUrl
  fileKind?: 'excel' | 'word' | 'ppt'; // what kind of file fileUrl contains
  pending?: 'image' | 'video' | 'pdf' | 'excel' | 'word' | 'ppt'; // media generation in flight
  error?: boolean; // the message represents a generation failure (shows a retry card)
  variants?: string[]; // alternate regenerated answers (assistant only)
  variantIndex?: number; // which variant is currently shown
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  uploadedFile?: string; // most-recently-added doc (kept for display)
  uploadedFiles?: string[]; // all docs/URLs indexed in this chat
  pinned?: boolean; // starred to the top of the sidebar
  folderId?: string | null; // folder/project this chat belongs to
  archived?: boolean; // hidden from the main list
  createdAt: number;
  updatedAt: number;
}

export interface Folder {
  id: string;
  name: string;
  instructions?: string; // applied to every chat in this folder (project context)
}

// ── Code mode (kept entirely separate from Chat-mode memory) ──
export interface CodeStep {
  path: string;
  action: 'edit' | 'create';
  reason: string;
  status: 'queued' | 'running' | 'done' | 'failed' | 'skipped';
}

export interface CodeChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  steps?: CodeStep[];
  files?: string[];
}

/** One Code-mode conversation. Persisted in localStorage, never on the server,
 *  and never shown in Chat mode — Code memory and Chat memory are isolated. */
export interface CodeSession {
  id: string;
  title: string;
  messages: CodeChatMessage[];
  folderName?: string; // last folder opened in this session (display hint)
  createdAt: number;
  updatedAt: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
}
