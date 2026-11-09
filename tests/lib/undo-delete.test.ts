import { describe, it, expect, vi, beforeEach } from 'vitest';

const toastMocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMocks }));

import { restorePeople, showUndoDeleteToast } from '@/lib/undo-delete';

describe('restorePeople', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restores every person and reports failures without stopping', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('bad')) return { ok: false } as Response;
      if (String(input).includes('boom')) throw new Error('network');
      return { ok: true } as Response;
    }) as typeof fetch;

    const result = await restorePeople(['p1', 'bad', 'boom', 'p2']);
    expect(result).toEqual({ restored: ['p1', 'p2'], failed: ['bad', 'boom'] });
    expect(global.fetch).toHaveBeenCalledWith('/api/people/p1/restore', { method: 'POST' });
  });
});

describe('showUndoDeleteToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(async () => ({ ok: true }) as Response) as typeof fetch;
  });

  const base = {
    message: 'Ann was moved to the trash',
    undoLabel: 'Undo',
    restoredMessage: 'Restored',
    failedMessage: 'Failed',
  };

  it('shows a toast with an undo action', () => {
    showUndoDeleteToast({ ...base, ids: ['p1'] });
    expect(toastMocks.success).toHaveBeenCalledWith(
      'Ann was moved to the trash',
      expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) })
    );
  });

  it('shows nothing when nobody was deleted', () => {
    showUndoDeleteToast({ ...base, ids: [] });
    expect(toastMocks.success).not.toHaveBeenCalled();
  });

  it('restores on undo and notifies the caller', async () => {
    const onRestored = vi.fn();
    showUndoDeleteToast({ ...base, ids: ['p1', 'p2'], onRestored });
    const options = toastMocks.success.mock.calls[0][1] as { action: { onClick: () => Promise<void> } };
    await options.action.onClick();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(toastMocks.success).toHaveBeenCalledWith('Restored');
    expect(onRestored).toHaveBeenCalledWith(['p1', 'p2']);
  });

  it('reports an error when restoring fails', async () => {
    global.fetch = vi.fn(async () => ({ ok: false }) as Response) as typeof fetch;
    const onRestored = vi.fn();
    showUndoDeleteToast({ ...base, ids: ['p1'], onRestored });
    const options = toastMocks.success.mock.calls[0][1] as { action: { onClick: () => Promise<void> } };
    await options.action.onClick();
    expect(toastMocks.error).toHaveBeenCalledWith('Failed');
    expect(onRestored).not.toHaveBeenCalled();
  });
});
