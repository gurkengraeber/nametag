import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../../locales/en.json';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import MapPersonCard from '../../components/map/MapPersonCard';
import MapPeoplePanel from '../../components/map/MapPeoplePanel';
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
  groupIds: [],
  hasPhoto: false,
  groupColor: null,
};

const person: MapPerson = {
  personId: 'p1',
  personName: 'Alice Example',
  groupIds: [],
  relationshipTypeId: null,
  lastContact: null,
};

const unplaced: UnplacedPerson = {
  personId: 'p9',
  personName: 'Nina Nowhere',
  reason: 'noAddress',
  addresses: [],
};

function CardHost({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open card
      </button>
      {open && (
        <MapPersonCard
          markers={[marker]}
          peopleById={new Map([[person.personId, person]])}
          relationshipTypes={[]}
          allGroups={[]}
          dateFormat="YMD"
          onClose={() => {
            onClose();
            setOpen(false);
          }}
          onStartSelection={vi.fn()}
          onPersonChange={vi.fn()}
          onSaved={vi.fn()}
        />
      )}
    </>
  );
}

function PanelHost({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open list
      </button>
      {open && (
        <MapPeoplePanel
          tab="noPlace"
          onTabChange={vi.fn()}
          onClose={() => {
            onClose();
            setOpen(false);
          }}
          onMap={[]}
          unplaced={[unplaced]}
          selectedIds={new Set()}
          onToggleSelected={vi.fn()}
          onShowOnMap={vi.fn()}
          geocodingEnabled
          defaultCountry="NO"
          onSavePlace={vi.fn().mockResolvedValue(true)}
          withSelectionBar={false}
        />
      )}
    </>
  );
}

describe('MapPersonCard keyboard', () => {
  it('takes focus when it opens, closes on Escape and gives focus back', async () => {
    const onClose = vi.fn();
    render(<CardHost onClose={onClose} />, { wrapper: Wrapper });
    const opener = screen.getByRole('button', { name: 'Open card' });
    opener.focus();
    await userEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Alice Example' });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});

describe('MapPeoplePanel keyboard', () => {
  it('takes focus when it opens, closes on Escape and gives focus back', async () => {
    const onClose = vi.fn();
    render(<PanelHost onClose={onClose} />, { wrapper: Wrapper });
    const opener = screen.getByRole('button', { name: 'Open list' });
    opener.focus();
    await userEvent.click(opener);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(opener).toHaveFocus();
  });

  it('closes the place form first and the panel with the next Escape', async () => {
    const onClose = vi.fn();
    render(<PanelHost onClose={onClose} />, { wrapper: Wrapper });
    await userEvent.click(screen.getByRole('button', { name: 'Open list' }));
    await userEvent.click(screen.getByRole('button', { name: 'Set place' }));
    expect(screen.getByLabelText('City')).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByLabelText('City')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
