import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamQuestion } from '@/services/api';

/** Build a fake fetch Response that streams the given SSE chunks. */
function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return { ok: true, body: stream } as unknown as Response;
}

afterEach(() => vi.unstubAllGlobals());

describe('streamQuestion', () => {
  it('parses token events in order', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          'data: {"type":"token","content":"Hel"}\n\n',
          'data: {"type":"token","content":"lo"}\n\n',
          'data: {"type":"done"}\n\n',
        ])
      )
    );
    const tokens: string[] = [];
    await streamQuestion('c1', 'hi', [], { onToken: (t) => tokens.push(t) });
    expect(tokens.join('')).toBe('Hello');
  });

  it('handles an event split across chunk boundaries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse(['data: {"type":"to', 'ken","content":"Hi"}\n\n'])
      )
    );
    const tokens: string[] = [];
    await streamQuestion('c1', 'hi', [], { onToken: (t) => tokens.push(t) });
    expect(tokens).toEqual(['Hi']);
  });

  it('delivers sources via onSources', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          'data: {"type":"sources","sources":[{"content":"x"}]}\n\n',
          'data: {"type":"token","content":"ok"}\n\n',
        ])
      )
    );
    let sources: unknown[] = [];
    await streamQuestion('c1', 'q', [], {
      onToken: () => {},
      onSources: (s) => {
        sources = s;
      },
    });
    expect(sources).toHaveLength(1);
  });

  it('reports error events via onError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse(['data: {"type":"error","message":"boom"}\n\n'])
      )
    );
    let err = '';
    await streamQuestion('c1', 'q', [], {
      onToken: () => {},
      onError: (m) => {
        err = m;
      },
    });
    expect(err).toBe('boom');
  });

  it('throws on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, body: null } as unknown as Response)
    );
    await expect(
      streamQuestion('c1', 'q', [], { onToken: () => {} })
    ).rejects.toThrow();
  });

  it('sends chat_id, question and history in the request body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(sseResponse(['data: {"type":"done"}\n\n']));
    vi.stubGlobal('fetch', fetchMock);

    await streamQuestion('c42', 'hello', [{ role: 'user', content: 'prev' }], {
      onToken: () => {},
    });

    const opts = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(opts.body as string);
    expect(body.chat_id).toBe('c42');
    expect(body.question).toBe('hello');
    expect(body.history).toEqual([{ role: 'user', content: 'prev' }]);
  });
});

// ── Autonomous agent path (POST /agent/task) ──
// The extra events are additive: /chat never sends them, so an ordinary chat
// stream must behave exactly as it did before these handlers existed.
describe('streamQuestion — agent events', () => {
  it('reports high-level stage labels via onStatus', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          'data: {"type":"status","stage":"planning","label":"Planning"}\n\n',
          'data: {"type":"status","stage":"research","label":"Researching"}\n\n',
          'data: {"type":"token","content":"answer"}\n\n',
          'data: {"type":"done"}\n\n',
        ])
      )
    );
    const stages: string[] = [];
    const tokens: string[] = [];
    await streamQuestion('c1', 'q', [], {
      onToken: (t) => tokens.push(t),
      onStatus: (label) => stages.push(label),
    });
    expect(stages).toEqual(['Planning', 'Researching']);
    expect(tokens).toEqual(['answer']);
  });

  it('delivers a generated image via onImage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          'data: {"type":"image","image":"data:image/png;base64,AAAA"}\n\n',
          'data: {"type":"done"}\n\n',
        ])
      )
    );
    let image = '';
    await streamQuestion('c1', 'draw a picture of a cat', [], {
      onToken: () => {},
      onImage: (d) => {
        image = d;
      },
    });
    expect(image).toBe('data:image/png;base64,AAAA');
  });

  it('ignores the internal task-state event rather than rendering it', async () => {
    // `task` carries the full plan and step statuses. Surfacing it would be the
    // chain-of-thought leak the fixed status vocabulary exists to avoid.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          'data: {"type":"task","task":{"plan":[{"id":1,"agent":"research"}]}}\n\n',
          'data: {"type":"token","content":"final"}\n\n',
        ])
      )
    );
    const tokens: string[] = [];
    await streamQuestion('c1', 'q', [], { onToken: (t) => tokens.push(t) });
    expect(tokens).toEqual(['final']);
  });

  it('posts a text turn to /agent/task by default', async () => {
    // /agent/task is a superset: it delegates anything that is not a genuine
    // multi-step goal back to the ordinary chat stream, so it is safe as the
    // default path for every message.
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(['data: {"type":"done"}\n\n']));
    vi.stubGlobal('fetch', fetchMock);
    await streamQuestion('c1', 'hi', [], { onToken: () => {} });
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/agent\/task$/);
  });

  it('sends a vision turn to /chat, never to the agent path', async () => {
    // A picture is not an agent task, and the orchestrator has no image in its
    // plan model — routing one there would lose it.
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(['data: {"type":"done"}\n\n']));
    vi.stubGlobal('fetch', fetchMock);
    await streamQuestion('c1', 'what is this', [], { onToken: () => {} },
      'data:image/png;base64,AAAA');
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/chat$/);
  });

  it('sends the identical body to whichever endpoint it picks', async () => {
    // Delegation is only transparent if the payload is the same.
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(['data: {"type":"done"}\n\n']));
    vi.stubGlobal('fetch', fetchMock);
    await streamQuestion('c1', 'hi', [{ role: 'user', content: 'earlier' }], { onToken: () => {} });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.chat_id).toBe('c1');
    expect(body.question).toBe('hi');
    expect(body.history).toEqual([{ role: 'user', content: 'earlier' }]);
  });

  it('survives a status event with no label', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          'data: {"type":"status"}\n\n',
          'data: {"type":"token","content":"ok"}\n\n',
        ])
      )
    );
    const stages: string[] = [];
    const tokens: string[] = [];
    await streamQuestion('c1', 'q', [], {
      onToken: (t) => tokens.push(t),
      onStatus: (l) => stages.push(l),
    });
    expect(stages).toEqual([]);
    expect(tokens).toEqual(['ok']);
  });
});
