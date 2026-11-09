import { describe, it, expect, vi, afterEach } from 'vitest';
import { navigateTo } from '@/lib/client-navigation';

describe('navigateTo', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the router while online', () => {
    const push = vi.fn();
    navigateTo({ push }, '/people/new');
    expect(push).toHaveBeenCalledWith('/people/new');
  });

  it('loads the page for real while offline, so the offline page can be served', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const push = vi.fn();

    navigateTo({ push }, '/people/new');

    expect(push).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith('/people/new');
    vi.unstubAllGlobals();
  });
});
