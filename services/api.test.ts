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
