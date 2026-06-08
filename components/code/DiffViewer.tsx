'use client';

import { useEffect, useRef } from 'react';
import { MergeView } from '@codemirror/merge';
import { EditorView, lineNumbers } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import { langFor } from './cmLang';

/**
 * Side-by-side, read-only diff of `original` (left) vs `modified` (right) using
 * CodeMirror's MergeView — the change highlighting + collapsed unchanged regions
 * give a Claude-Code-style review surface. Imperative because MergeView mounts
 * directly into a DOM node.
 */
export function DiffViewer({
  original,
  modified,
  path,
  theme,
}: {
  original: string;
  modified: string;
  path: string;
  theme: 'dark' | 'light';
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.innerHTML = '';
    const common = [
      lineNumbers(),
      EditorView.editable.of(false),
      EditorView.lineWrapping,
      ...langFor(path),
      ...(theme === 'dark' ? [oneDark] : []),
    ];
    const mv = new MergeView({
      a: { doc: original, extensions: common },
      b: { doc: modified, extensions: common },
      parent: host,
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: { margin: 3, minSize: 4 },
    });
    return () => mv.destroy();
  }, [original, modified, path, theme]);

  return <div ref={ref} className="cm-merge-host h-full w-full overflow-auto text-[13px]" />;
}
