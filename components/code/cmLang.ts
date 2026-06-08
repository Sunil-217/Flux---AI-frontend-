/* Map a file path to the right CodeMirror language extension + a display label.
   Shared by the editor and the diff viewer so highlighting is consistent. */
import type { Extension } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { sql } from '@codemirror/lang-sql';
import { rust } from '@codemirror/lang-rust';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { php } from '@codemirror/lang-php';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { go } from '@codemirror/lang-go';

function ext(path: string): string {
  const base = path.toLowerCase().split('/').pop() ?? '';
  if (base === 'dockerfile') return 'dockerfile';
  return base.includes('.') ? base.split('.').pop()! : base;
}

/** CodeMirror language extension(s) for a file path (empty array = plain text). */
export function langFor(path: string): Extension[] {
  switch (ext(path)) {
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return [javascript({ jsx: true })];
    case 'ts':
      return [javascript({ typescript: true })];
    case 'tsx':
      return [javascript({ jsx: true, typescript: true })];
    case 'py':
      return [python()];
    case 'html':
    case 'htm':
    case 'vue':
    case 'svelte':
    case 'astro':
      return [html()];
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return [css()];
    case 'json':
      return [json()];
    case 'md':
    case 'markdown':
      return [markdown()];
    case 'sql':
      return [sql()];
    case 'rs':
      return [rust()];
    case 'java':
    case 'kt':
      return [java()];
    case 'c':
    case 'h':
    case 'cpp':
    case 'hpp':
    case 'cc':
    case 'cs':
      return [cpp()];
    case 'php':
      return [php()];
    case 'xml':
      return [xml()];
    case 'yaml':
    case 'yml':
      return [yaml()];
    case 'go':
      return [go()];
    default:
      return [];
  }
}

/** Short human label for the active file's language (shown in the editor chrome). */
export function langLabel(path: string): string {
  const map: Record<string, string> = {
    js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
    ts: 'TypeScript', tsx: 'TypeScript', py: 'Python', html: 'HTML', htm: 'HTML',
    css: 'CSS', scss: 'SCSS', sass: 'Sass', less: 'Less', json: 'JSON',
    md: 'Markdown', markdown: 'Markdown', sql: 'SQL', rs: 'Rust', java: 'Java',
    kt: 'Kotlin', go: 'Go', cpp: 'C++', cc: 'C++', hpp: 'C++', c: 'C', h: 'C',
    cs: 'C#', php: 'PHP', xml: 'XML', yaml: 'YAML', yml: 'YAML', rb: 'Ruby',
    sh: 'Shell', bash: 'Shell', vue: 'Vue', svelte: 'Svelte', toml: 'TOML',
  };
  return map[ext(path)] ?? (ext(path) ? ext(path).toUpperCase() : 'Text');
}
