'use client';

/* File System Access API helpers — let the user pick a local folder, read its
   code files, and write edits back to disk (Chrome/Edge, secure context).
   The API isn't in TS's lib.dom typings, so we use `any` casts deliberately. */
/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CodeFileEntry {
  path: string; // relative path within the chosen folder
}

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'out', '.venv', 'venv',
  '__pycache__', '.idea', '.vscode', 'coverage', '.turbo', 'target', '.cache',
  'vendor', '.svn', 'bin', 'obj',
]);

const ALLOWED_EXT = new Set([
  'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'h', 'cpp', 'hpp', 'cs', 'go',
  'rs', 'rb', 'php', 'swift', 'kt', 'scala', 'sh', 'bash', 'zsh', 'sql', 'html',
  'css', 'scss', 'sass', 'less', 'json', 'yaml', 'yml', 'toml', 'xml', 'md',
  'txt', 'env', 'gitignore', 'dockerfile', 'vue', 'svelte', 'astro', 'r', 'lua',
  'dart', 'ex', 'exs', 'pl', 'ini', 'cfg', 'conf',
]);

const MAX_FILES = 300;
const MAX_FILE_BYTES = 200_000;

export function fsSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/** Prompt the user to choose a folder (read+write). Returns null if cancelled/unsupported. */
export async function pickDirectory(): Promise<any | null> {
  if (!fsSupported()) return null;
  try {
    return await (window as any).showDirectoryPicker({ mode: 'readwrite' });
  } catch {
    return null; // user cancelled
  }
}

function isAllowed(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower === 'dockerfile' || lower === '.gitignore' || lower === '.env') return true;
  const ext = lower.includes('.') ? lower.split('.').pop()! : '';
  return ALLOWED_EXT.has(ext);
}

/** Recursively list code/text files in the folder (filtered + capped). */
export async function listCodeFiles(dir: any): Promise<CodeFileEntry[]> {
  const out: CodeFileEntry[] = [];
  async function walk(handle: any, prefix: string) {
    for await (const [name, entry] of handle.entries()) {
      if (out.length >= MAX_FILES) return;
      if (entry.kind === 'directory') {
        if (IGNORE_DIRS.has(name) || (name.startsWith('.') && name !== '.env')) continue;
        await walk(entry, prefix ? `${prefix}/${name}` : name);
      } else if (isAllowed(name)) {
        out.push({ path: prefix ? `${prefix}/${name}` : name });
      }
    }
  }
  await walk(dir, '');
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

async function fileHandleFor(dir: any, path: string, create = false): Promise<any> {
  const parts = path.split('/');
  let cur = dir;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = await cur.getDirectoryHandle(parts[i], { create });
  }
  return cur.getFileHandle(parts[parts.length - 1], { create });
}

/** Read a file's text by relative path. */
export async function readFileText(dir: any, path: string): Promise<string> {
  const handle = await fileHandleFor(dir, path);
  const file = await handle.getFile();
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('File is too large to open here (over 200 KB).');
  }
  return file.text();
}

/** Write text back to a file by relative path (creates it if missing). */
export async function writeFileText(dir: any, path: string, content: string): Promise<void> {
  const handle = await fileHandleFor(dir, path, true);
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

/** Create a new file at `path` (optionally seeded with content). Throws if it already exists. */
export async function createFile(dir: any, path: string, content = ''): Promise<void> {
  let exists = true;
  try {
    await fileHandleFor(dir, path);
  } catch {
    exists = false;
  }
  if (exists) throw new Error('A file with that name already exists.');
  await writeFileText(dir, path, content);
}

/** Delete the file at `path`. */
export async function deleteFile(dir: any, path: string): Promise<void> {
  const parts = path.split('/');
  let cur = dir;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = await cur.getDirectoryHandle(parts[i]);
  }
  await cur.removeEntry(parts[parts.length - 1]);
}

/** Rename/move a file: copy its contents to `newPath`, then delete `oldPath`. */
export async function renameFile(dir: any, oldPath: string, newPath: string): Promise<void> {
  if (oldPath === newPath) return;
  const content = await readFileText(dir, oldPath);
  let exists = true;
  try {
    await fileHandleFor(dir, newPath);
  } catch {
    exists = false;
  }
  if (exists) throw new Error('A file with that name already exists.');
  await writeFileText(dir, newPath, content);
  await deleteFile(dir, oldPath);
}

export interface SearchHit {
  path: string;
  line: number; // 1-based
  text: string; // trimmed matching line (truncated)
}

/**
 * Grep-style, case-insensitive substring search across the given files.
 * Reads each file (skipping unreadable/oversized ones) and collects matching
 * lines. Capped at `maxHits` total to stay responsive on big projects.
 */
export async function searchInFiles(
  dir: any,
  query: string,
  files: CodeFileEntry[],
  maxHits = 200
): Promise<SearchHit[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];
  for (const f of files) {
    if (hits.length >= maxHits) break;
    let text: string;
    try {
      text = await readFileText(dir, f.path);
    } catch {
      continue;
    }
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(q)) {
        hits.push({ path: f.path, line: i + 1, text: lines[i].trim().slice(0, 200) });
        if (hits.length >= maxHits) break;
      }
    }
  }
  return hits;
}
