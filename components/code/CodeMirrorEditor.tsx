'use client';

import { useMemo } from 'react';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { langFor } from './cmLang';

/** Syntax-highlighted code editor (CodeMirror 6). Fills its parent's height. */
export function CodeMirrorEditor({
  value,
  onChange,
  path,
  readOnly = false,
  theme,
}: {
  value: string;
  onChange?: (v: string) => void;
  path: string;
  readOnly?: boolean;
  theme: 'dark' | 'light';
}) {
  const extensions = useMemo(() => [EditorView.lineWrapping, ...langFor(path)], [path]);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme={theme === 'dark' ? oneDark : 'light'}
      extensions={extensions}
      readOnly={readOnly}
      editable={!readOnly}
      height="100%"
      style={{ height: '100%', fontSize: '13px' }}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: !readOnly,
        highlightActiveLineGutter: !readOnly,
        autocompletion: true,
        bracketMatching: true,
        closeBrackets: !readOnly,
        indentOnInput: !readOnly,
      }}
    />
  );
}
