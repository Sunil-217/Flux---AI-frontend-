'use client';

import { useEffect, useRef, useState } from 'react';

type Kind = 'excel' | 'word' | 'ppt';

const META: Record<Kind, { label: string; bg: string; border: string; text: string }> = {
  excel: { label: 'XLSX', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  word: { label: 'DOCX', bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-400' },
  ppt: { label: 'PPTX', bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400' },
};

/** Decode a base64 data: URI into raw bytes (for the Office parsers). */
function dataUriToBytes(src: string): Uint8Array {
  const comma = src.indexOf(',');
  const b64 = comma >= 0 ? src.slice(comma + 1) : src;
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function download(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

interface SheetData {
  name: string;
  rows: string[][];
}
interface SlideData {
  title: string;
  bullets: string[];
}

function Spinner() {
  return (
    <svg className="w-7 h-7 animate-spin text-[var(--accent-fg)]" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Full-screen in-app viewer for the documents the app generates.
 *  - Excel (.xlsx) → SheetJS parses the workbook; rendered as themed HTML tables with sheet tabs.
 *  - Word (.docx)  → docx-preview renders a faithful, Word-like page into a container.
 *  - PPT (.pptx)   → JSZip unzips the deck; each slide's title + bullets are rendered as a slide card.
 *
 * All rendering is client-side (no public URL / external viewer needed), and the
 * heavy libraries are dynamically imported so they only load when a viewer opens.
 */
export function OfficeViewer({
  src,
  filename,
  kind,
  onClose,
}: {
  src: string;
  filename: string;
  kind: Kind;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const wordRef = useRef<HTMLDivElement>(null);
  const meta = META[kind];

  // Esc to close.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const bytes = dataUriToBytes(src);

        if (kind === 'excel') {
          const XLSX = await import('xlsx');
          const wb = XLSX.read(bytes, { type: 'array' });
          const out: SheetData[] = wb.SheetNames.map((name) => {
            const ws = wb.Sheets[name];
            const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as unknown[][];
            const rows = raw.map((r) => r.map((c) => String(c ?? '')));
            return { name, rows };
          });
          if (!cancelled) {
            setSheets(out);
            setStatus('ready');
          }
        } else if (kind === 'ppt') {
          const JSZip = (await import('jszip')).default;
          const zip = await JSZip.loadAsync(bytes);
          const names = Object.keys(zip.files)
            .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
            .sort(
              (a, b) =>
                parseInt(a.match(/slide(\d+)\.xml/)?.[1] ?? '0', 10) -
                parseInt(b.match(/slide(\d+)\.xml/)?.[1] ?? '0', 10)
            );
          const parser = new DOMParser();
          const out: SlideData[] = [];
          for (const n of names) {
            const xml = await zip.files[n].async('string');
            const doc = parser.parseFromString(xml, 'application/xml');
            const shapes = Array.from(doc.getElementsByTagName('p:sp'));
            let title = '';
            const bullets: string[] = [];
            for (const sp of shapes) {
              const ph = sp.getElementsByTagName('p:ph')[0];
              const phType = ph?.getAttribute('type') ?? '';
              const paras = Array.from(sp.getElementsByTagName('a:p'));
              const texts = paras
                .map((p) =>
                  Array.from(p.getElementsByTagName('a:t'))
                    .map((t) => t.textContent ?? '')
                    .join('')
                )
                .map((s) => s.trim())
                .filter(Boolean);
              if ((phType === 'title' || phType === 'ctrTitle') && !title) {
                title = texts.join(' ');
              } else {
                bullets.push(...texts);
              }
            }
            if (!title && bullets.length) title = bullets.shift() ?? '';
            out.push({ title, bullets });
          }
          if (!cancelled) {
            setSlides(out);
            setStatus('ready');
          }
        } else {
          // word — docx-preview renders into the container element directly.
          const { renderAsync } = await import('docx-preview');
          if (wordRef.current) {
            wordRef.current.innerHTML = '';
            await renderAsync(new Blob([bytes as BlobPart]), wordRef.current, undefined, {
              className: 'docx',
              inWrapper: true,
              ignoreLastRenderedPageBreak: true,
            });
          }
          if (!cancelled) setStatus('ready');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src, kind]);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex flex-col bg-[var(--base)]">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-[var(--elevated)] border-b border-[var(--line)] flex-shrink-0">
        <div className={`w-9 h-9 flex-shrink-0 rounded ${meta.bg} border ${meta.border} flex items-center justify-center`}>
          <span className={`text-[9px] font-bold tracking-wide ${meta.text}`}>{meta.label}</span>
        </div>
        <span className="text-sm font-medium text-[var(--ink)] truncate flex-1 min-w-0">{filename}</span>

        {/* Excel sheet tabs live in the header when there's more than one. */}
        {kind === 'excel' && status === 'ready' && sheets.length > 1 && (
          <div className="hidden sm:flex items-center gap-1 mr-1 max-w-[40%] overflow-x-auto">
            {sheets.map((s, i) => (
              <button
                key={s.name}
                onClick={() => setActiveSheet(i)}
                className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors ${
                  i === activeSheet
                    ? 'bg-[var(--fill-hover)] text-[var(--ink)] border border-[var(--line-strong)]'
                    : 'text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] border border-transparent'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => download(src, filename)}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-3)] hover:text-[var(--ink)] px-2.5 py-1.5 rounded-lg hover:bg-[var(--fill)] border border-[var(--line)] transition-colors flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
          </svg>
          Download
        </button>
        <button
          onClick={onClose}
          title="Close"
          aria-label="Close"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-auto bg-neutral-100 dark:bg-neutral-900">
        {status === 'loading' && (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <Spinner />
            <span className="text-xs text-[var(--ink-3)]">Opening {meta.label}…</span>
          </div>
        )}

        {status === 'error' && (
          <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-[var(--ink-2)]">Couldn&apos;t render a preview of this file.</p>
            <button
              onClick={() => download(src, filename)}
              className="text-xs font-medium text-[var(--accent-fg)] hover:underline"
            >
              Download it instead
            </button>
          </div>
        )}

        {/* Excel — themed table for the active sheet */}
        {status === 'ready' && kind === 'excel' && (
          <div className="p-4 sm:p-6">
            {sheets[activeSheet] && sheets[activeSheet].rows.length > 0 ? (
              <div className="inline-block min-w-full overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--base)]">
                <table className="border-collapse text-sm">
                  <tbody>
                    {sheets[activeSheet].rows.map((row, ri) => (
                      <tr key={ri} className={ri === 0 ? '' : ri % 2 === 0 ? 'bg-[var(--fill)]/40' : ''}>
                        <td className="border-r border-b border-[var(--line)] px-2 py-1 text-[11px] text-[var(--ink-4)] text-right select-none bg-[var(--fill)] sticky left-0">
                          {ri + 1}
                        </td>
                        {row.map((cell, ci) =>
                          ri === 0 ? (
                            <th
                              key={ci}
                              className="border-b border-r border-[var(--line)] px-3 py-2 text-left font-semibold text-[var(--ink)] bg-[var(--fill)] whitespace-nowrap"
                            >
                              {cell}
                            </th>
                          ) : (
                            <td
                              key={ci}
                              className="border-b border-r border-[var(--line)] px-3 py-1.5 text-[var(--ink-2)] whitespace-nowrap"
                            >
                              {cell}
                            </td>
                          )
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-[var(--ink-3)]">This sheet is empty.</p>
            )}
          </div>
        )}

        {/* PPT — one card per slide */}
        {status === 'ready' && kind === 'ppt' && (
          <div className="mx-auto max-w-3xl p-4 sm:p-6 space-y-5">
            {slides.length === 0 && <p className="text-sm text-[var(--ink-3)]">No slides found.</p>}
            {slides.map((s, i) => (
              <div
                key={i}
                className="aspect-[16/9] w-full rounded-xl border border-[var(--line)] bg-[var(--base)] shadow-sm p-6 sm:p-8 flex flex-col overflow-hidden"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="text-lg sm:text-xl font-semibold text-[var(--ink)] leading-snug">
                    {s.title || `Slide ${i + 1}`}
                  </h3>
                  <span className="text-[11px] text-[var(--ink-4)] flex-shrink-0 mt-1">{i + 1} / {slides.length}</span>
                </div>
                {s.bullets.length > 0 && (
                  <ul className="space-y-2 overflow-auto">
                    {s.bullets.map((b, bi) => (
                      <li key={bi} className="flex gap-2.5 text-[var(--ink-2)] text-sm sm:text-base leading-relaxed">
                        <span className={`mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.text} bg-current`} />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Word — docx-preview renders here; container must always exist for the ref */}
        {kind === 'word' && (
          <div className={`flex justify-center p-4 sm:p-6 ${status === 'ready' ? '' : 'hidden'}`}>
            <div ref={wordRef} className="docx-host bg-white rounded-lg shadow-sm" />
          </div>
        )}
      </div>
    </div>
  );
}
