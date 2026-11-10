import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useConnectionTest } from '@/components/carddav/useConnectionTest';

const input = { serverUrl: 'https://dav.example.com', username: 'ada', password: 'x' };
const books = [{ url: 'https://dav.example.com/ab/', displayName: 'Contacts', description: null, contactCount: 3 }];

function deferredFetch() {
  let resolve!: (response: Response) => void;
  global.fetch = vi.fn(
    () => new Promise<Response>((r) => { resolve = r; })
  ) as unknown as typeof fetch;
  return {
    answer: (status: number, body: unknown) =>
      resolve({ ok: status < 300, status, json: () => Promise.resolve(body) } as Response),
  };
}

describe('useConnectionTest', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the books of a successful test', async () => {
    const server = deferredFetch();
    const { result } = renderHook(() => useConnectionTest());

    let outcome: unknown;
    act(() => { void result.current.run(input).then((r) => { outcome = r; }); });
    expect(result.current.state.status).toBe('testing');
    await act(async () => server.answer(200, { addressBooks: books }));

    await waitFor(() => expect(result.current.state.status).toBe('success'));
    expect(outcome).toEqual(books);
  });

  it('ignores an answer that arrives after the form was edited', async () => {
    const server = deferredFetch();
    const { result } = renderHook(() => useConnectionTest());

    let outcome: unknown = 'pending';
    act(() => { void result.current.run(input).then((r) => { outcome = r; }); });
    act(() => result.current.reset());
    await act(async () => server.answer(200, { addressBooks: books }));

    await waitFor(() => expect(outcome).toBeNull());
    expect(result.current.state.status).toBe('idle');
  });

  it('lets only the newest of two overlapping tests set the result', async () => {
    const answers: Array<(r: Response) => void> = [];
    global.fetch = vi.fn(
      () => new Promise<Response>((r) => { answers.push(r); })
    ) as unknown as typeof fetch;
    const { result } = renderHook(() => useConnectionTest());

    act(() => { void result.current.run(input); });
    act(() => { void result.current.run({ ...input, username: 'grace' }); });
    const ok = (body: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(body) }) as Response;
    await act(async () => answers[0](ok({ addressBooks: [] })));
    expect(result.current.state.status).toBe('testing');
    await act(async () => answers[1](ok({ addressBooks: books })));

    await waitFor(() => expect(result.current.state.status).toBe('success'));
    expect(result.current.state).toMatchObject({ books });
  });

  it('reports a request that never got an answer', async () => {
    global.fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch;
    const { result } = renderHook(() => useConnectionTest());

    await act(async () => { await result.current.run(input); });

    expect(result.current.state).toEqual({ status: 'failure', kind: 'network', serverMessage: null });
  });
});
