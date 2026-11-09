import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import { SearchIndexProvider, useSearchIndex } from '@/components/SearchIndexProvider';

// One stable session object: a fresh one per render would reload the index forever.
const session = vi.hoisted(() => ({ data: { user: { id: 'user-1' } } }));

vi.mock('next-auth/react', () => ({
  useSession: () => session,
}));

const person = {
  id: 'p1',
  name: 'Ada',
  surname: 'Lovelace',
  middleName: null,
  secondLastName: null,
  nickname: null,
  organization: null,
  jobTitle: null,
  notes: null,
  phones: '',
  emails: '',
  addresses: '',
  urls: '',
  imHandles: '',
  groups: 'Chess',
  customFields: '',
  photo: null,
  groupIds: ['g1'],
  groupNames: ['Chess'],
};

function Probe() {
  const index = useSearchIndex();
  return (
    <div>
      <span data-testid="state">
        {JSON.stringify({
          ready: index.isReady,
          error: index.hasError,
          empty: index.isEmpty,
          version: index.version,
          groups: index.groups.length,
          types: index.relationshipTypes.length,
          user: index.userId,
          found: index.search('ada').map((hit) => hit.id),
          stored: index.getPerson('p1')?.groupNames ?? null,
        })}
      </span>
      <button onClick={index.refreshIndex}>refresh</button>
    </div>
  );
}

const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}');

describe('SearchIndexProvider', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        people: [person],
        groups: [{ id: 'g1', name: 'Chess' }],
        relationshipTypes: [{ id: 'rt1', label: 'Friend' }],
      }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
  });

  it('loads the index with the groups and relationship types for the quick actions', async () => {
    render(
      <SearchIndexProvider>
        <Probe />
      </SearchIndexProvider>
    );

    await waitFor(() => expect(state().ready).toBe(true));
    expect(state()).toMatchObject({
      error: false,
      empty: false,
      version: 1,
      groups: 1,
      types: 1,
      user: 'user-1',
      found: ['p1'],
      stored: ['Chess'],
    });
  });

  it('bumps the version when the index is refreshed', async () => {
    render(
      <SearchIndexProvider>
        <Probe />
      </SearchIndexProvider>
    );
    await waitFor(() => expect(state().version).toBe(1));

    await act(async () => {
      screen.getByText('refresh').click();
    });

    await waitFor(() => expect(state().version).toBe(2));
  });

  it('does not reload the people when only the session object is replaced', async () => {
    const { rerender } = render(
      <SearchIndexProvider>
        <Probe />
      </SearchIndexProvider>
    );
    await waitFor(() => expect(state().ready).toBe(true));
    expect(global.fetch).toHaveBeenCalledTimes(1);

    session.data = { user: { id: 'user-1' } };
    rerender(
      <SearchIndexProvider>
        <Probe />
      </SearchIndexProvider>
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(state().ready).toBe(true);
  });

  it('drops the people of the previous account when the user signs out', async () => {
    const original = session.data;
    const { rerender } = render(
      <SearchIndexProvider>
        <Probe />
      </SearchIndexProvider>
    );
    await waitFor(() => expect(state().found).toEqual(['p1']));

    session.data = null as unknown as typeof original;
    rerender(
      <SearchIndexProvider>
        <Probe />
      </SearchIndexProvider>
    );

    await waitFor(() => expect(state()).toMatchObject({ ready: false, found: [], stored: null, groups: 0 }));
    session.data = original;
  });

  it('reports an empty library', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ people: [] }),
    }) as unknown as typeof fetch;

    render(
      <SearchIndexProvider>
        <Probe />
      </SearchIndexProvider>
    );

    await waitFor(() => expect(state().ready).toBe(true));
    expect(state()).toMatchObject({ empty: true, groups: 0, types: 0 });
  });

  it.each([
    ['a server error', () => Promise.resolve({ ok: false, json: async () => ({}) })],
    ['a network failure', () => Promise.reject(new Error('offline'))],
    ['an unexpected payload', () => Promise.resolve({ ok: true, json: async () => ({ nope: true }) })],
  ])('flags %s instead of failing silently', async (_label, respond) => {
    global.fetch = vi.fn().mockImplementation(respond) as unknown as typeof fetch;

    render(
      <SearchIndexProvider>
        <Probe />
      </SearchIndexProvider>
    );

    await waitFor(() => expect(state().error).toBe(true));
    expect(state().ready).toBe(false);
  });
});
