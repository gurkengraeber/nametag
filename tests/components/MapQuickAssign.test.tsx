import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../../locales/en.json';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import MapPersonCard from '../../components/map/MapPersonCard';
import MapPeoplePanel from '../../components/map/MapPeoplePanel';
import MapSelectionBar from '../../components/map/MapSelectionBar';
import type { MapMarker, MapPerson, UnplacedPerson } from '../../lib/map/types';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

const marker: MapMarker = {
  id: 'addr_1',
  source: 'address',
  personId: 'p1',
  personName: 'Alice Example',
  latitude: 59.9,
  longitude: 10.7,
  label: 'home',
  city: 'Oslo',
  region: null,
  country: 'NO',
  addressText: 'Oslo, Norway',
  groupIds: ['g1'],
  hasPhoto: false,
  groupColor: null,
};

const person: MapPerson = {
  personId: 'p1',
  personName: 'Alice Example',
  groupIds: ['g1'],
  relationshipTypeId: null,
  lastContact: null,
};

const groups = [
  { id: 'g1', name: 'Family', color: '#112233' },
  { id: 'g2', name: 'Climbing', color: null },
];
const relationshipTypes = [{ id: 'r1', label: 'Friend', color: null }];

describe('MapPersonCard', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderCard(overrides: Partial<React.ComponentProps<typeof MapPersonCard>> = {}) {
    const props = {
      markers: [marker],
      peopleById: new Map([[person.personId, person]]),
      relationshipTypes,
      allGroups: groups,
      dateFormat: 'YMD' as const,
      onClose: vi.fn(),
      onStartSelection: vi.fn(),
      onPersonChange: vi.fn(),
      onSaved: vi.fn(),
      ...overrides,
    };
    render(<MapPersonCard {...props} />, { wrapper: Wrapper });
    return props;
  }

  it('shows name, groups and that nobody talked to the person yet', () => {
    renderCard();
    expect(screen.getByRole('heading', { name: 'Alice Example' })).toBeInTheDocument();
    expect(screen.getByText('Family')).toBeInTheDocument();
    expect(screen.getByText('Never recorded')).toBeInTheDocument();
  });

  it('marks the person as contacted today without leaving the map', async () => {
    const props = renderCard();
    await userEvent.click(screen.getByRole('button', { name: 'Contacted today' }));

    await waitFor(() => expect(props.onSaved).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/people/p1');
    expect(init.method).toBe('PUT');
    expect(Object.keys(JSON.parse(String(init.body)))).toEqual(['lastContact']);
    expect(props.onPersonChange).toHaveBeenCalledWith('p1', expect.objectContaining({ lastContact: expect.any(String) }));
  });

  it('changes the relationship with a partial update', async () => {
    const props = renderCard();
    await userEvent.selectOptions(screen.getByLabelText('Relationship'), 'r1');

    await waitFor(() => expect(props.onSaved).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ relationshipToUserId: 'r1' });
  });

  it('adds a group through the bulk route and only offers groups the person is not in', async () => {
    const props = renderCard();
    const select = screen.getByLabelText('Add to group...');
    expect(screen.queryByRole('option', { name: 'Family' })).not.toBeInTheDocument();
    await userEvent.selectOptions(select, 'g2');

    await waitFor(() => expect(props.onSaved).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/people/bulk');
    expect(JSON.parse(String(init.body))).toEqual({ action: 'addToGroups', personIds: ['p1'], groupIds: ['g2'] });
  });

  it('undoes the local change when saving fails', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    const props = renderCard();
    await userEvent.click(screen.getByRole('button', { name: 'Contacted today' }));

    await waitFor(() => expect(props.onPersonChange).toHaveBeenCalledTimes(2));
    expect(props.onPersonChange).toHaveBeenLastCalledWith('p1', { lastContact: null });
    expect(props.onSaved).not.toHaveBeenCalled();
  });

  it('lets people switch between everyone at a shared address', async () => {
    const second: MapMarker = { ...marker, id: 'addr_2', personId: 'p2', personName: 'Bob Example' };
    const bob: MapPerson = { ...person, personId: 'p2', personName: 'Bob Example', groupIds: [] };
    renderCard({
      markers: [marker, second],
      peopleById: new Map([
        ['p1', person],
        ['p2', bob],
      ]),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Bob Example' }));
    expect(screen.getByRole('heading', { name: 'Bob Example' })).toBeInTheDocument();
    expect(screen.getByText('Not in any group')).toBeInTheDocument();
  });
});

describe('MapPeoplePanel quick place entry', () => {
  const unplaced: UnplacedPerson = {
    personId: 'p9',
    personName: 'Nina Nowhere',
    reason: 'noAddress',
    addresses: [],
  };

  function renderPanel(onSavePlace = vi.fn().mockResolvedValue(true), geocodingEnabled = true) {
    render(
      <MapPeoplePanel
        tab="noPlace"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
        onMap={[]}
        unplaced={[unplaced]}
        selectedIds={new Set()}
        onToggleSelected={vi.fn()}
        onShowOnMap={vi.fn()}
        geocodingEnabled={geocodingEnabled}
        defaultCountry="NO"
        onSavePlace={onSavePlace}
        withSelectionBar={false}
      />,
      { wrapper: Wrapper }
    );
    return onSavePlace;
  }

  it('saves city and the preselected country', async () => {
    const onSavePlace = renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Set place' }));
    await userEvent.type(screen.getByLabelText('City'), 'Bergen');
    await userEvent.click(screen.getByRole('button', { name: 'Save place' }));

    await waitFor(() => expect(onSavePlace).toHaveBeenCalledWith(unplaced, 'Bergen', 'NO'));
  });

  it('shows an error and keeps the form when saving fails', async () => {
    renderPanel(vi.fn().mockResolvedValue(false));
    await userEvent.click(screen.getByRole('button', { name: 'Set place' }));
    await userEvent.type(screen.getByLabelText('City'), 'Bergen');
    await userEvent.click(screen.getByRole('button', { name: 'Save place' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the place');
    expect(screen.getByLabelText('City')).toBeInTheDocument();
  });

  it('offers no entry form when locating is turned off', () => {
    renderPanel(undefined, false);
    expect(screen.queryByRole('button', { name: 'Set place' })).not.toBeInTheDocument();
    expect(screen.getByText(/Address locating is turned off/)).toBeInTheDocument();
  });
});

describe('MapSelectionBar', () => {
  it('shows the count and triggers the bulk actions', async () => {
    const onAddToGroups = vi.fn();
    const onSetRelationship = vi.fn();
    const onClear = vi.fn();
    render(
      <MapSelectionBar count={3} onClear={onClear} onAddToGroups={onAddToGroups} onSetRelationship={onSetRelationship} />,
      { wrapper: Wrapper }
    );
    expect(screen.getByText('3 selected')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add to Groups' }));
    await userEvent.click(screen.getByRole('button', { name: 'Set Relationship' }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(onAddToGroups).toHaveBeenCalled();
    expect(onSetRelationship).toHaveBeenCalled();
    expect(onClear).toHaveBeenCalled();
  });
});
