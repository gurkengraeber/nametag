import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import PersonForm from '../../components/PersonForm';
import enMessages from '../../locales/en.json';
import { getPersonFormDefaultsKey } from '@/lib/person-form-support';
import { restoreTimezoneAfterEach, setProcessTimezone } from '../helpers/timezone';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/SearchIndexProvider', () => ({
  useSearchIndex: () => ({ refreshIndex: vi.fn(), search: vi.fn(), isReady: false }),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

const baseProps = {
  groups: [{ id: 'g-1', name: 'Family', color: null }],
  relationshipTypes: [
    { id: 'rt-1', label: 'Friend', color: null },
    { id: 'rt-2', label: 'Colleague', color: null },
  ],
  mode: 'create' as const,
  dateFormat: 'MDY' as const,
  defaultReminderLeadDays: 0,
  userId: 'user-1',
};

describe('PersonForm (create) flow', () => {
  restoreTimezoneAfterEach();

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the form locked after a successful save so it cannot be sent twice', async () => {
    const user = userEvent.setup();
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ person: { id: 'p-1' } }),
    } as Response);
    render(
      <Wrapper>
        <PersonForm {...baseProps} />
      </Wrapper>
    );

    await user.type(screen.getByLabelText(/^name/i), 'Alex{Enter}');

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/people/p-1'));
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  });

  it('accepts today as last contact shortly after local midnight east of UTC', async () => {
    setProcessTimezone('Europe/Berlin');
    // 00:30 on 2 March in Berlin, still 1 March in UTC.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-01T23:30:00.000Z'));
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ person: { id: 'p-1' } }),
    } as Response);
    render(
      <Wrapper>
        <PersonForm
          {...baseProps}
          mode="edit"
          person={{
            id: 'p-1',
            name: 'Alex',
            surname: null,
            middleName: null,
            secondLastName: null,
            nickname: null,
            prefix: null,
            suffix: null,
            organization: null,
            jobTitle: null,
            lastContact: new Date('2026-03-02T00:00:00.000Z'),
            notes: null,
            relationshipToUserId: null,
            groups: [],
          }}
        />
      </Wrapper>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(enMessages.people.form.errorFutureDate)).not.toBeInTheDocument();
  });

  it('puts the cursor in the name field and folds the extra sections away', () => {
    render(
      <Wrapper>
        <PersonForm {...baseProps} />
      </Wrapper>
    );

    expect(screen.getByLabelText(/^name/i)).toHaveFocus();
    expect(screen.getByRole('button', { name: 'More details' })).toHaveAttribute('aria-expanded', 'false');
    // Folded sections stay mounted but are not visible
    expect(screen.queryByRole('button', { name: /Notes/ })).not.toBeInTheDocument();
  });

  it('reveals the extra sections on request', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <PersonForm {...baseProps} />
      </Wrapper>
    );

    await user.click(screen.getByRole('button', { name: 'More details' }));
    expect(screen.getByRole('button', { name: /Notes/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fewer details' })).toBeInTheDocument();
  });

  it('applies the remembered relationship and groups without counting them as unsaved changes', async () => {
    window.localStorage.setItem(
      getPersonFormDefaultsKey('user-1'),
      JSON.stringify({ userId: 'user-1', savedAt: Date.now(), relationshipToUserId: 'rt-2', groupIds: ['g-1'] })
    );
    const addSpy = vi.spyOn(window, 'addEventListener');
    render(
      <Wrapper>
        <PersonForm {...baseProps} />
      </Wrapper>
    );

    await waitFor(() => expect(screen.getByLabelText(/relationship to you/i)).toHaveValue('rt-2'));
    expect(screen.getByText('Family')).toBeInTheDocument();
    expect(addSpy.mock.calls.some(([type]) => type === 'beforeunload')).toBe(false);
    addSpy.mockRestore();
  });

  it('ignores remembered values of another account', async () => {
    window.localStorage.setItem(
      getPersonFormDefaultsKey('user-2'),
      JSON.stringify({ userId: 'user-2', savedAt: Date.now(), relationshipToUserId: 'rt-2', groupIds: [] })
    );
    render(
      <Wrapper>
        <PersonForm {...baseProps} />
      </Wrapper>
    );
    expect(screen.getByLabelText(/relationship to you/i)).toHaveValue('');
  });

  it('saves with Enter in the name field and remembers the choices (ids only)', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      getPersonFormDefaultsKey('user-1'),
      JSON.stringify({ userId: 'user-1', savedAt: Date.now(), relationshipToUserId: 'rt-1', groupIds: ['g-1'] })
    );
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ person: { id: 'p-1' } }),
    } as Response);
    render(
      <Wrapper>
        <PersonForm {...baseProps} />
      </Wrapper>
    );
    await waitFor(() => expect(screen.getByLabelText(/relationship to you/i)).toHaveValue('rt-1'));

    await user.type(screen.getByLabelText(/^name/i), 'Alex{Enter}');

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe('/api/people');
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      name: 'Alex',
      relationshipToUserId: 'rt-1',
      groupIds: ['g-1'],
    });
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/people/p-1'));

    const stored = window.localStorage.getItem(getPersonFormDefaultsKey('user-1')) ?? '';
    expect(stored).not.toContain('Alex');
  });

  it('shows a server validation error at the field instead of only at the top', async () => {
    const user = userEvent.setup();
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'Validation failed',
        fields: [{ path: 'name', issue: 'too_long', params: { max: 100 } }],
      }),
    } as Response);
    render(
      <Wrapper>
        <PersonForm {...baseProps} />
      </Wrapper>
    );

    await user.selectOptions(screen.getByLabelText(/relationship to you/i), 'rt-1');
    await user.type(screen.getByLabelText(/^name/i), 'Alex');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    const message = await screen.findByText('Please use at most 100 characters.');
    expect(screen.getByLabelText(/^name/i)).toHaveAttribute('aria-describedby', 'name-error');
    expect(message).toHaveAttribute('id', 'name-error');
    expect(screen.getByText('Please check the marked fields.')).toBeInTheDocument();
  });

  it('has a visible "Create and add another" button', () => {
    render(
      <Wrapper>
        <PersonForm {...baseProps} />
      </Wrapper>
    );
    expect(screen.getByRole('button', { name: 'Create and add another' })).toBeVisible();
  });
});
