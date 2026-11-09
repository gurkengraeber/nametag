import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useUnsavedChangesWarning } from '@/components/settings/useUnsavedChangesWarning';

function Probe({ dirty }: { dirty: boolean }) {
  useUnsavedChangesWarning(dirty, 'Leave?');
  return <a href="/settings/security">Security</a>;
}

describe('useUnsavedChangesWarning', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not interfere while the form is clean', () => {
    const confirm = vi.spyOn(window, 'confirm');
    const { getByText } = render(<Probe dirty={false} />);
    fireEvent.click(getByText('Security'));
    expect(confirm).not.toHaveBeenCalled();
  });

  it('asks before following a link and cancels the click when declined', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { getByText } = render(<Probe dirty />);
    const notPrevented = fireEvent.click(getByText('Security'));
    expect(confirm).toHaveBeenCalledWith('Leave?');
    expect(notPrevented).toBe(false);
  });

  it('lets the click through when confirmed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { getByText } = render(<Probe dirty />);
    // jsdom does not navigate; the click must simply not be prevented.
    expect(fireEvent.click(getByText('Security'))).toBe(true);
  });

  it('registers the browser prompt only while dirty', () => {
    const { rerender } = render(<Probe dirty />);
    const dirtyEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);

    rerender(<Probe dirty={false} />);
    const cleanEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);
  });
});
