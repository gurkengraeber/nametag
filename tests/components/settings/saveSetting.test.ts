import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveSetting } from '@/components/settings/saveSetting';

describe('saveSetting', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends the body as JSON with the given method', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    const result = await saveSetting('/api/user/theme', { theme: 'DARK' });
    expect(result).toEqual({ ok: true });
    expect(spy).toHaveBeenCalledWith('/api/user/theme', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: 'DARK' }),
    });
  });

  it('returns the server message on failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Nope' }), { status: 400 })
    );
    expect(await saveSetting('/x', {})).toEqual({ ok: false, error: 'Nope' });
  });

  it('returns a null message when the body is not JSON', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('boom', { status: 500 }));
    expect(await saveSetting('/x', {})).toEqual({ ok: false, error: null });
  });

  it('returns a null message when the network fails', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('offline'));
    expect(await saveSetting('/x', {})).toEqual({ ok: false, error: null });
  });
});
