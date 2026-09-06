'use client';

import { useState } from 'react';

/**
 * The multi-agent pipeline, as it actually ran.
 *
 * **This visualises status the backend reported. It does not model, predict or
 * infer execution.** A node lights up only after a stage label naming it has
 * arrived over SSE; a node the backend never mentioned stays dark for the whole
 * run, which is the truthful outcome — most tasks touch two or three of these,
 * and drawing the rest as "pending" would imply work that is not queued.
 *
 * The nodes correspond to the orchestrator's own agents (planner, research,
 * RAG, code, analyse, critic). The labels are the closed, safe set the backend
 * chose to emit — never reasoning, never internal detail.
 */

interface NodeDef {
  id: string;
  label: string;
  x: number;
  y: number;
  /** Stage labels that light this node. Exactly the strings the backend sends. */
  stages: string[];
}

const NODES: NodeDef[] = [
  { id: 'plan', label: 'Plan', x: 100, y: 18, stages: ['Planning'] },
  { id: 'research', label: 'Research', x: 30, y: 74, stages: ['Researching'] },
  { id: 'docs', label: 'Documents', x: 100, y: 74, stages: ['Reading your documents'] },
  { id: 'make', label: 'Create', x: 170, y: 74, stages: ['Writing code', 'Creating the image', 'Translating'] },
  { id: 'analyse', label: 'Analyse', x: 100, y: 128, stages: ['Analyzing', 'Putting it together'] },
  { id: 'verify', label: 'Verify', x: 100, y: 172, stages: ['Verifying', 'Correcting'] },
];

const LINKS: [string, string][] = [
  ['plan', 'research'],
  ['plan', 'docs'],
  ['plan', 'make'],
  ['research', 'analyse'],
  ['docs', 'analyse'],
  ['make', 'analyse'],
  ['analyse', 'verify'],
];

const BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]));

function nodeFor(stage: string): string | null {
  return NODES.find((n) => n.stages.includes(stage))?.id ?? null;
}

/**
 * Which nodes have been reached during THIS run.
 *
 * Reset when a run ends rather than persisting: a network still lit from the
 * last question would claim work is happening now.
 */
function useTrace(status: string, running: boolean): string[] {
  const [trace, setTrace] = useState<{ run: boolean; seen: string[] }>({
    run: false,
    seen: [],
  });

  // Adjusted DURING RENDER, not in an effect. This is derived state — it is a
  // function of props that happens to accumulate — and syncing it from an
  // effect would render the stale trace first and then immediately render
  // again, which is both a wasted pass and a visible flicker on a graph that
  // changes several times a second. React documents this pattern for exactly
  // this case; it terminates because `next` is only a new object when
  // something actually changed.
  let next = trace;

  // A run starting clears the previous one. A network still lit from the last
  // question would claim work is happening now.
  if (running !== trace.run) {
    next = { run: running, seen: running ? [] : trace.seen };
  }

  if (running) {
    const id = nodeFor(status);
    if (id && !next.seen.includes(id)) {
      next = { run: next.run, seen: [...next.seen, id] };
    }
  }

  if (next !== trace) setTrace(next);

  return next.seen;
}

export function AgentNetwork({
  status,
  running,
}: {
  status: string;
  running: boolean;
}) {
  const seen = useTrace(status, running);
  const activeId = running ? nodeFor(status) : null;

  const stateOf = (id: string): 'active' | 'done' | 'idle' => {
    if (id === activeId) return 'active';
    return seen.includes(id) ? 'done' : 'idle';
  };

  // A link carries flow only while its DOWNSTREAM node is the active one —
  // that is the moment data is genuinely moving into it.
  const linkState = (from: string, to: string): 'flow' | 'done' | 'idle' => {
    if (to === activeId && seen.includes(from)) return 'flow';
    if (seen.includes(from) && seen.includes(to)) return 'done';
    return 'idle';
  };

  const idle = !running || seen.length === 0;

  return (
    <div className="fx-net" data-idle={idle ? 'true' : 'false'}>
      <svg viewBox="0 0 200 190" className="fx-net__svg" aria-hidden="true">
        {LINKS.map(([from, to]) => {
          const a = BY_ID[from];
          const b = BY_ID[to];
          return (
            <line
              key={`${from}-${to}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className="fx-net__link"
              data-state={linkState(from, to)}
            />
          );
        })}

        {NODES.map((n) => (
          <g key={n.id} className="fx-net__node" data-state={stateOf(n.id)}>
            <circle cx={n.x} cy={n.y} r="13" className="fx-net__halo" />
            <circle cx={n.x} cy={n.y} r="6" className="fx-net__dot" />
            <text x={n.x} y={n.y + 25} className="fx-net__label">
              {n.label}
            </text>
          </g>
        ))}
      </svg>

      {/* The text readout is the accessible source of truth; the graph above is
          decoration for it, which is why the SVG is aria-hidden. */}
      <p className="fx-net__status" aria-live="polite">
        {running ? status || 'Working' : 'Awaiting data'}
      </p>
    </div>
  );
}
