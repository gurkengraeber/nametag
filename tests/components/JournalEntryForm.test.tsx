import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../../locales/en.json';
import { newEntryDraftKey, writeDraft } from '../../lib/journal';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock('sonner', () => ({
  toast: { success: mocks.toastSuccess, error: vi.fn() },
}));

import JournalEntryForm from '../../components/JournalEntryForm';

const people = [
  { id: 'p1', name: 'Ada', surname: 'Lovelace' },
  { id: 'p2', name: 'Alan', surname: 'Turing' },
];

function renderForm(props: Partial<React.ComponentProps<typeof JournalEntryForm>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <JournalEntryForm mode="create" userId="user-1" availablePeople={people} {...props} />
    </NextIntlClientProvider>,
  );
}

describe('JournalEntryForm quick entry', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ entry: { id: 'new-1' } }) });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens with the cursor in the text field and today as the date', () => {
    renderForm();
    expect(document.activeElement).toBe(document.getElementById('journal-body'));
    const today = new Date();
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(screen.getByLabelText('Date')).toHaveValue(expected);
  });

  it('starts with prefilled people and explains the last contact option', () => {
    renderForm({ prefill: { personIds: ['p1', 'unknown'] } });
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
    expect(screen.getByText(/last contact is already later/i)).toBeInTheDocument();
  });

  it('leaves last contact alone for an entry dated in the future', () => {
    renderForm({ prefill: { personIds: ['p1'], date: '2999-01-01' } });
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByText(/dated in the future/i)).toBeInTheDocument();
  });

  it('offers recent people as one tap chips', () => {
    renderForm({ recentPersonIds: ['p2', 'p1'] });
    fireEvent.click(screen.getByRole('button', { name: /Alan Turing/ }));
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^\+\s*Alan Turing/ })).toBeNull();
  });

  it('saves with Ctrl+Enter, derives a title from the first line and returns to the timeline', async () => {
    renderForm({ returnHref: '/journal?person=p1' });
    const body = document.getElementById('journal-body') as HTMLTextAreaElement;
    fireEvent.change(body, { target: { value: 'Dinner at the lake\nIt was warm.' } });
    fireEvent.keyDown(body, { key: 'Enter', ctrlKey: true });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/journal');
    expect(JSON.parse(init.body as string)).toMatchObject({
      title: 'Dinner at the lake',
      body: 'Dinner at the lake\nIt was warm.',
      hasTime: false,
    });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/journal?person=p1'));
  });

  it('refuses to save an empty entry and says why', async () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Save entry' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Write something before saving.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not send an entry whose time was cleared when saving and adding another', () => {
    renderForm();
    const body = document.getElementById('journal-body') as HTMLTextAreaElement;
    fireEvent.change(body, { target: { value: 'Late night walk' } });
    fireEvent.click(screen.getByRole('button', { name: /Add time/ }));
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save and add another' }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the form open for the next entry after "Save and add another"', async () => {
    renderForm({ prefill: { personIds: ['p1'] } });
    const body = document.getElementById('journal-body') as HTMLTextAreaElement;
    fireEvent.change(body, { target: { value: 'First thought' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and add another' }));

    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalled());
    expect(mocks.push).not.toHaveBeenCalled();
    await waitFor(() => expect(body).toHaveValue(''));
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('restores the draft of this account and ignores the draft of another account', async () => {
    writeDraft(newEntryDraftKey('user-1'), 'user-1', {
      title: '',
      body: 'Unsent thoughts',
      date: null,
      time: null,
      hasTime: false,
      personIds: ['p2'],
    });
    writeDraft(newEntryDraftKey('user-2'), 'user-2', {
      title: '',
      body: 'Someone else',
      date: null,
      time: null,
      hasTime: false,
      personIds: [],
    });
    renderForm();
    expect(await screen.findByDisplayValue('Unsent thoughts')).toBeInTheDocument();
    expect(screen.getByText('Alan Turing')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('restored your unsaved draft');
    expect(screen.queryByDisplayValue('Someone else')).toBeNull();
  });

  it('stores the draft while typing and removes it after saving', async () => {
    vi.useFakeTimers();
    try {
      renderForm();
      const body = document.getElementById('journal-body') as HTMLTextAreaElement;
      fireEvent.change(body, { target: { value: 'Typing along' } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      const key = newEntryDraftKey('user-1');
      expect(window.localStorage.getItem(key)).toContain('Typing along');
      expect(JSON.parse(window.localStorage.getItem(key) ?? '{}').userId).toBe('user-1');

      fireEvent.click(screen.getByRole('button', { name: 'Save entry' }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });
      expect(window.localStorage.getItem(key)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
