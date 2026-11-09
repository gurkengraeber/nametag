import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import NavigationSearch from '@/components/NavigationSearch';
import { clearNameOrderCache } from '@/lib/user-name-order';
import { getLocalDateString } from '@/lib/date-format';
import enMessages from '@/locales/en.json';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refreshIndex: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

interface IndexState {
  isReady: boolean;
  isEmpty: boolean;
  hits: Array<Record<string, unknown>>;
  stored: Record<string, Record<string, unknown>>;
}

const index = vi.hoisted<IndexState>(() => ({ isReady: true, isEmpty: false, hits: [], stored: {} }));

const GROUPS = [
  { id: 'g1', name: 'Chess club' },
  { id: 'g2', name: 'Family' },
];
const TYPES = [
  { id: 'rt1', label: 'Friend' },
  { id: 'rt2', label: 'Colleague' },
];

// One frozen object: NavigationSearch re-runs its search whenever `search` changes identity.
const searchApi = vi.hoisted(() => {
  const api = {
    search: (query: string) => (query ? index.hits : []),
    getPerson: (id: string) => index.stored[id] ?? null,
    version: 1,
    hasError: false,
    groups: [] as unknown[],
    relationshipTypes: [] as unknown[],
    refreshIndex: () => {},
    userId: 'user-1',
    get isReady() {
      return index.isReady;
    },
    get isEmpty() {
      return index.isEmpty;
    },
  };
  return api;
});
vi.mock('@/components/SearchIndexProvider', () => ({
  useSearchIndex: () => ({ ...searchApi, refreshIndex: mocks.refreshIndex }),
}));

const ADA = {
  id: 'p1',
  name: 'Ada',
  surname: 'Lovelace',
  relationship: 'Friend',
  relationshipTypeId: 'rt1',
  groupIds: ['g1'],
  groupNames: ['Chess club'],
  locality: 'Lisbon',
  lastContact: '2020-01-01',
  matchedIn: 'notes',
};

function fetchMock() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/user/profile') return { ok: true, json: async () => ({ user: {} }) };
    if (url.startsWith('/api/people/search?')) return { ok: true, json: async () => ({ people: [{ id: 'p9', name: 'Server', surname: 'Hit' }] }) };
    void init;
    return { ok: true, json: async () => ({ success: true }) };
  });
}

function renderSearch() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <NavigationSearch />
    </NextIntlClientProvider>
  );
}

function calls(mock: ReturnType<typeof fetchMock>, urlPart: string) {
  return mock.mock.calls.filter(([url]) => String(url).includes(urlPart));
}

describe('NavigationSearch', () => {
  let fetchSpy: ReturnType<typeof fetchMock>;

  beforeEach(() => {
    clearNameOrderCache();
    window.localStorage.clear();
    mocks.push.mockReset();
    mocks.refreshIndex.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
    index.isReady = true;
    index.isEmpty = false;
    index.hits = [ADA];
    index.stored = { p1: ADA };
    searchApi.groups = GROUPS;
    searchApi.relationshipTypes = TYPES;
    fetchSpy = fetchMock();
    global.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
  });

  it('shows relationship, groups and place next to a hit, and why it matched', async () => {
    const user = userEvent.setup();
    renderSearch();

    await user.type(screen.getByPlaceholderText(enMessages.nav.search.placeholder), 'ada');

    const row = await screen.findByRole('button', { name: /Ada Lovelace/ });
    expect(row).toHaveTextContent('Friend');
    expect(row).toHaveTextContent('Chess club');
    expect(row).toHaveTextContent('Lisbon');
    expect(row).toHaveTextContent(enMessages.nav.search.matchedIn.notes);
  });

  it('opens the profile on Enter and remembers it for next time', async () => {
    const user = userEvent.setup();
    renderSearch();

    await user.type(screen.getByPlaceholderText(enMessages.nav.search.placeholder), 'ada{Enter}');

    expect(mocks.push).toHaveBeenCalledWith('/people/p1');
    expect(window.localStorage.getItem('nametag:recent-people:user-1')).toContain('p1');
  });

  it('marks someone as contacted today with Shift+Enter, without leaving the page', async () => {
    const user = userEvent.setup();
    renderSearch();

    await user.type(screen.getByPlaceholderText(enMessages.nav.search.placeholder), 'ada');
    await screen.findByRole('button', { name: /Ada Lovelace/ });
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.click(await screen.findByRole('button', { name: enMessages.nav.search.actions.contactedToday }));

    await waitFor(() => expect(calls(fetchSpy, '/api/people/p1')).toHaveLength(1));
    const [url, init] = calls(fetchSpy, '/api/people/p1')[0];
    expect(url).toBe('/api/people/p1');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({ lastContact: getLocalDateString() });
    expect(mocks.push).not.toHaveBeenCalled();
    await waitFor(() => expect(mocks.refreshIndex).toHaveBeenCalled());
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });

  it('opens the quick actions with Tab', async () => {
    const user = userEvent.setup();
    renderSearch();

    await user.type(screen.getByPlaceholderText(enMessages.nav.search.placeholder), 'ada');
    await screen.findByRole('button', { name: /Ada Lovelace/ });
    await user.tab();

    expect(await screen.findByRole('group', { name: enMessages.nav.search.actions.title })).toBeInTheDocument();
    const first = screen.getByRole('button', { name: enMessages.nav.search.actions.contactedToday });
    expect(document.activeElement).toBe(first);
  });

  it('disables "contacted today" when it already happened today', async () => {
    const user = userEvent.setup();
    index.hits = [{ ...ADA, lastContact: getLocalDateString() }];
    renderSearch();

    await user.type(screen.getByPlaceholderText(enMessages.nav.search.placeholder), 'ada');
    await user.click(await screen.findByRole('button', { name: enMessages.nav.search.actions.title }));

    expect(screen.getByRole('button', { name: enMessages.nav.search.actions.alreadyContactedToday })).toBeDisabled();
  });

  it('adds a person to a group from the results', async () => {
    const user = userEvent.setup();
    renderSearch();

    await user.type(screen.getByPlaceholderText(enMessages.nav.search.placeholder), 'ada');
    await user.click(await screen.findByRole('button', { name: enMessages.nav.search.actions.title }));
    await user.click(screen.getByRole('button', { name: enMessages.nav.search.actions.addToGroup }));

    // Already a member: shown, but cannot be picked again.
    expect(screen.getByRole('button', { name: 'Chess club' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Family' }));

    await waitFor(() => expect(calls(fetchSpy, '/api/people/bulk')).toHaveLength(1));
    const [, init] = calls(fetchSpy, '/api/people/bulk')[0];
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      action: 'addToGroups',
      personIds: ['p1'],
      groupIds: ['g2'],
    });
    await waitFor(() => expect(mocks.refreshIndex).toHaveBeenCalled());
  });

  it('sets the relationship from the results', async () => {
    const user = userEvent.setup();
    renderSearch();

    await user.type(screen.getByPlaceholderText(enMessages.nav.search.placeholder), 'ada');
    await user.click(await screen.findByRole('button', { name: enMessages.nav.search.actions.title }));
    await user.click(screen.getByRole('button', { name: enMessages.nav.search.actions.setRelationship }));
    await user.click(screen.getByRole('button', { name: 'Colleague' }));

    await waitFor(() => expect(calls(fetchSpy, '/api/people/bulk')).toHaveLength(1));
    const [, init] = calls(fetchSpy, '/api/people/bulk')[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      action: 'setRelationship',
      personIds: ['p1'],
      relationshipTypeId: 'rt2',
    });
  });

  it('tells the user when a quick action fails and keeps the panel', async () => {
    const user = userEvent.setup();
    fetchSpy.mockImplementation(async (url: string) =>
      url === '/api/user/profile'
        ? { ok: true, json: async () => ({ user: {} }) }
        : { ok: false, json: async () => ({}) }
    );
    renderSearch();

    await user.type(screen.getByPlaceholderText(enMessages.nav.search.placeholder), 'ada');
    await user.click(await screen.findByRole('button', { name: enMessages.nav.search.actions.title }));
    await user.click(screen.getByRole('button', { name: enMessages.nav.search.actions.contactedToday }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(mocks.refreshIndex).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: enMessages.nav.search.actions.title })).toBeInTheDocument();
  });

  it('closes the quick actions with Escape before closing the search', async () => {
    const user = userEvent.setup();
    renderSearch();

    await user.type(screen.getByPlaceholderText(enMessages.nav.search.placeholder), 'ada');
    await user.click(await screen.findByRole('button', { name: enMessages.nav.search.actions.title }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('group', { name: enMessages.nav.search.actions.title })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(enMessages.nav.search.placeholder)).toHaveValue('ada');
  });

  it('suggests recently opened people when the field is empty', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      'nametag:recent-people:user-1',
      JSON.stringify({ userId: 'user-1', entries: [{ id: 'p1', at: Date.now() }, { id: 'gone', at: Date.now() }] })
    );
    renderSearch();

    await user.click(screen.getByPlaceholderText(enMessages.nav.search.placeholder));

    expect(await screen.findByText(enMessages.nav.search.recent)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ada Lovelace/ })).toBeInTheDocument();
    // People that no longer exist drop out of the stored list.
    expect(window.localStorage.getItem('nametag:recent-people:user-1')).not.toContain('gone');
  });

  it('points a user without people to the first steps', async () => {
    const user = userEvent.setup();
    index.isEmpty = true;
    index.hits = [];
    index.stored = {};
    renderSearch();

    await user.click(screen.getByPlaceholderText(enMessages.nav.search.placeholder));

    expect(await screen.findByText(enMessages.nav.search.emptyTitle)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: enMessages.nav.search.addPerson })).toHaveAttribute('href', '/people/new');
    expect(screen.getByRole('link', { name: enMessages.nav.search.importContacts })).toHaveAttribute('href', '/settings/carddav');
  });

  it('offers to add the searched name as a new person when nothing matches', async () => {
    const user = userEvent.setup();
    index.hits = [];
    renderSearch();

    await user.type(screen.getByPlaceholderText(enMessages.nav.search.placeholder), 'Zed Zorn');

    const link = await screen.findByRole('link', { name: 'Add "Zed Zorn" as a new person' });
    expect(link).toHaveAttribute('href', '/people/new?name=Zed%20Zorn');
  });

  describe('without the local index', () => {
    beforeEach(() => {
      index.isReady = false;
    });

    it('falls back to the server and shows plain hits without quick actions', async () => {
      const user = userEvent.setup();
      renderSearch();

      await user.type(screen.getByPlaceholderText(enMessages.nav.search.placeholder), 'server');

      expect(await screen.findByRole('button', { name: /Server Hit/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: enMessages.nav.search.actions.title })).not.toBeInTheDocument();
    });

    it('says so when the server cannot be reached, and retries on request', async () => {
      const user = userEvent.setup();
      let fail = true;
      fetchSpy.mockImplementation(async (url: string) => {
        if (url === '/api/user/profile') return { ok: true, json: async () => ({ user: {} }) };
        if (fail) throw new Error('offline');
        return { ok: true, json: async () => ({ people: [{ id: 'p9', name: 'Server', surname: 'Hit' }] }) };
      });
      renderSearch();

      await user.type(screen.getByPlaceholderText(enMessages.nav.search.placeholder), 'server');

      const alert = await screen.findByRole('alert');
      expect(within(alert).getByText(enMessages.nav.search.error)).toBeInTheDocument();
      expect(screen.queryByText(/No people found/)).not.toBeInTheDocument();

      fail = false;
      await user.click(within(alert).getByRole('button', { name: enMessages.nav.search.retry }));

      expect(await screen.findByRole('button', { name: /Server Hit/ })).toBeInTheDocument();
    });
  });
});
