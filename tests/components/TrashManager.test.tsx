import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import TrashManager from '../../components/TrashManager';

const refreshIndexMock = vi.hoisted(() => vi.fn());

vi.mock('@/components/SearchIndexProvider', () => ({
  useSearchIndex: () => ({ refreshIndex: refreshIndexMock, search: vi.fn(), isReady: false }),
}));
import enMessages from '../../locales/en.json';

const deletedAt = new Date().toISOString();
const deletedEighteenDaysAgo = new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString();

const deletedByType: Record<string, unknown[]> = {
  people: [
    { id: 'p1', name: 'Jan', surname: 'Kowalski', nickname: null, displayNameOverride: null, deletedAt },
    { id: 'p5', name: 'Maria', surname: 'Garcia', nickname: null, displayNameOverride: null, deletedAt: deletedEighteenDaysAgo },
  ],
  groups: [],
  relationships: [
    {
      id: 'r1',
      deletedAt,
      person: { id: 'p2', name: 'Anna', surname: 'Nowak' },
      relatedPerson: { id: 'p3', name: 'Piotr', surname: null },
      relationshipType: { id: 't1', label: 'Friend' },
    },
  ],
  relationshipTypes: [],
  importantDates: [
    {
      id: 'd1',
      title: 'Birthday',
      date: '2000-05-17T00:00:00.000Z',
      deletedAt,
      person: { id: 'p4', name: 'Ewa', surname: 'Zielona' },
    },
  ],
};

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe('TrashManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const type = new URL(String(input), 'http://localhost').searchParams.get('type') ?? '';
      return {
        ok: true,
        json: async () => ({ deleted: deletedByType[type] ?? [] }),
      } as Response;
    }) as typeof fetch;
  });

  // Regression: switching from the People tab used to render the people items
  // with the relationship/important-date label renderer for one frame, which
  // read fields people do not have and crashed the whole settings page.
  it('switches from People to Relationships and Important Dates without crashing', async () => {
    const user = userEvent.setup();
    render(<Wrapper><TrashManager /></Wrapper>);

    expect(await screen.findByText('Jan Kowalski')).toBeInTheDocument();

    // The tab buttons carry a count badge once the counts load, so their
    // accessible name is e.g. "Relationships1" (or just "Relationships" before).
    await user.click(screen.getByRole('button', { name: /^Relationships\d*$/ }));
    expect(await screen.findByText('Anna Nowak - Friend - Piotr')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Important Dates\d*$/ }));
    expect(await screen.findByText(/^Birthday \(.+\) for Ewa Zielona$/)).toBeInTheDocument();
  });

  it('shows every type in the All tab with the remaining time', async () => {
    render(<Wrapper><TrashManager /></Wrapper>);

    expect(await screen.findByText('Jan Kowalski')).toBeInTheDocument();
    expect(screen.getByText('Anna Nowak - Friend - Piotr')).toBeInTheDocument();
    expect(screen.getByText(/Permanently deleted in 12 days/)).toBeInTheDocument();
    expect(screen.getAllByText(/Permanently deleted in 30 days/).length).toBeGreaterThan(0);
  });

  it('filters the list by search text', async () => {
    const user = userEvent.setup();
    render(<Wrapper><TrashManager /></Wrapper>);

    await screen.findByText('Jan Kowalski');
    await user.type(screen.getByRole('searchbox', { name: 'Search deleted items' }), 'garcia');

    expect(screen.getByText('Maria Garcia')).toBeInTheDocument();
    expect(screen.queryByText('Jan Kowalski')).not.toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText(/Nothing in the trash matches "zzz"/)).toBeInTheDocument();
  });

  it('restores several selected items at once', async () => {
    const user = userEvent.setup();
    const restoreCalls: string[] = [];
    const baseFetch = global.fetch;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        restoreCalls.push(String(input));
        return { ok: true, json: async () => ({}) } as Response;
      }
      return baseFetch(input, init);
    }) as typeof fetch;

    render(<Wrapper><TrashManager /></Wrapper>);
    await screen.findByText('Jan Kowalski');

    await user.click(screen.getByRole('checkbox', { name: 'Select Jan Kowalski' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Maria Garcia' }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Restore selected' }));

    await waitFor(() => expect(screen.queryByText('Jan Kowalski')).not.toBeInTheDocument());
    expect(screen.queryByText('Maria Garcia')).not.toBeInTheDocument();
    expect(restoreCalls.sort()).toEqual(['/api/people/p1/restore', '/api/people/p5/restore']);
    expect(refreshIndexMock).toHaveBeenCalled();
  });

  it('only allows permanent deletion after the explicit confirmation', async () => {
    const user = userEvent.setup();
    render(<Wrapper><TrashManager /></Wrapper>);
    await screen.findByText('Jan Kowalski');

    await user.click(screen.getAllByRole('button', { name: 'Delete permanently' })[0]);

    const confirmButtons = screen.getAllByRole('button', { name: 'Delete permanently' });
    const confirm = confirmButtons[confirmButtons.length - 1];
    expect(confirm).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: 'I understand this cannot be undone' }));
    expect(confirm).toBeEnabled();
  });

  it('shows a friendly empty state when nothing was deleted', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ deleted: [], retentionDays: 30 }),
    }) as Response) as typeof fetch;

    render(<Wrapper><TrashManager /></Wrapper>);
    expect(await screen.findByText('The trash is empty')).toBeInTheDocument();
    expect(screen.getByText(/stays here for 30 days/)).toBeInTheDocument();
  });
});
