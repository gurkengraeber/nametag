import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useUndoPersonDelete } from '../../hooks/useUndoPersonDelete';
import enMessages from '../../locales/en.json';

const toastMocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const refreshIndex = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: toastMocks }));
vi.mock('@/components/SearchIndexProvider', () => ({
  useSearchIndex: () => ({ refreshIndex, search: vi.fn(), isReady: false }),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe('useUndoPersonDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(async () => ({ ok: true }) as Response) as typeof fetch;
  });

  it('names the person for a single delete', () => {
    const { result } = renderHook(() => useUndoPersonDelete(), { wrapper: Wrapper });
    result.current({ ids: ['p1'], name: 'Ann Lee' });
    expect(toastMocks.success).toHaveBeenCalledWith('Ann Lee was moved to the trash', expect.anything());
  });

  it('counts people for a bulk delete', () => {
    const { result } = renderHook(() => useUndoPersonDelete(), { wrapper: Wrapper });
    result.current({ ids: ['p1', 'p2', 'p3'] });
    expect(toastMocks.success).toHaveBeenCalledWith('3 people were moved to the trash', expect.anything());
  });

  it('restores, refreshes the search index and calls onRestored on undo', async () => {
    const onRestored = vi.fn();
    const { result } = renderHook(() => useUndoPersonDelete(), { wrapper: Wrapper });
    result.current({ ids: ['p1'], name: 'Ann Lee', onRestored });
    const options = toastMocks.success.mock.calls[0][1] as { action: { onClick: () => Promise<void> } };
    await options.action.onClick();
    expect(global.fetch).toHaveBeenCalledWith('/api/people/p1/restore', { method: 'POST' });
    expect(refreshIndex).toHaveBeenCalled();
    expect(onRestored).toHaveBeenCalled();
  });
});
