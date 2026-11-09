import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import KeyboardShortcuts from '@/components/KeyboardShortcuts';
import enMessages from '@/locales/en.json';

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

const onFocusSearch = vi.fn();

function Harness({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <KeyboardShortcuts onFocusSearch={onFocusSearch} helpOpen={open} onHelpOpenChange={setOpen} />
      {children}
    </NextIntlClientProvider>
  );
}

describe('KeyboardShortcuts', () => {
  beforeEach(() => {
    mocks.push.mockReset();
    onFocusSearch.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('focuses the search with a slash', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.keyboard('/');

    expect(onFocusSearch).toHaveBeenCalledTimes(1);
  });

  it('starts a new person with n', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.keyboard('n');

    expect(mocks.push).toHaveBeenCalledWith('/people/new');
  });

  it.each([
    ['p', '/people'],
    ['g', '/groups'],
    ['m', '/map'],
    ['j', '/journal'],
  ])('goes to the page for g then %s', async (letter, href) => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.keyboard(`g${letter}`);

    expect(mocks.push).toHaveBeenCalledWith(href);
  });

  it('does nothing while typing in a field', async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <input aria-label="note" />
      </Harness>
    );

    await user.click(screen.getByLabelText('note'));
    await user.keyboard('n/?gp');

    expect(mocks.push).not.toHaveBeenCalled();
    expect(onFocusSearch).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('leaves Ctrl and Cmd combinations to the browser', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.keyboard('{Control>}n{/Control}');

    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('does nothing while another dialog is open', async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <div role="dialog" aria-modal="true" />
      </Harness>
    );

    await user.keyboard('n');

    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('shows the help with a question mark and lists the shortcuts', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.keyboard('?');

    const dialog = await screen.findByRole('dialog', { name: enMessages.nav.shortcuts.title });
    expect(dialog).toHaveTextContent(enMessages.nav.shortcuts.newPerson);
    expect(dialog).toHaveTextContent(enMessages.nav.shortcuts.goTo);
    expect(dialog).toHaveTextContent(enMessages.nav.journal);
  });

  it('closes the help with a second question mark or Escape', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.keyboard('?');
    await user.keyboard('?');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.keyboard('?');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
