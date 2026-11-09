import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { RelationshipCell, LastContactCell, LocationCell, toDateInputValue } from '../../components/QuickEditCells';
import enMessages from '../../locales/en.json';

const toastError = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));

const fetchMock = vi.fn();

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

const okResponse = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) });

const lastRequest = () => {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return { url, method: init.method, body: JSON.parse(init.body) };
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  fetchMock.mockImplementation(okResponse);
  vi.stubGlobal('fetch', fetchMock);
});

describe('toDateInputValue', () => {
  it('returns the stored calendar day', () => {
    expect(toDateInputValue(new Date('2026-08-10T00:00:00.000Z'))).toBe('2026-08-10');
    expect(toDateInputValue('2026-08-10T00:00:00.000Z')).toBe('2026-08-10');
  });

  it('returns an empty string for no or an invalid date', () => {
    expect(toDateInputValue(null)).toBe('');
    expect(toDateInputValue('nonsense')).toBe('');
  });
});

describe('RelationshipCell', () => {
  const types = [
    { id: 'rt-1', label: 'Friend', color: null },
    { id: 'rt-2', label: 'Family', color: null },
  ];

  it('saves the chosen relationship type and reports it', async () => {
    const onSaved = vi.fn();
    render(
      <Wrapper>
        <RelationshipCell personId="p-1" value={null} types={types} onSaved={onSaved} />
      </Wrapper>
    );

    await userEvent.selectOptions(screen.getByLabelText('Relationship to User'), 'rt-2');

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(lastRequest()).toEqual({
      url: '/api/people/p-1/quick-update',
      method: 'PATCH',
      body: { relationshipToUserId: 'rt-2' },
    });
  });

  it('sends null when the relationship is cleared', async () => {
    render(
      <Wrapper>
        <RelationshipCell personId="p-1" value="rt-1" types={types} />
      </Wrapper>
    );

    await userEvent.selectOptions(screen.getByLabelText('Relationship to User'), '');

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(lastRequest().body).toEqual({ relationshipToUserId: null });
  });

  it('goes back to the old value and shows an error when saving fails', async () => {
    fetchMock.mockImplementation(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }));
    render(
      <Wrapper>
        <RelationshipCell personId="p-1" value="rt-1" types={types} />
      </Wrapper>
    );

    await userEvent.selectOptions(screen.getByLabelText('Relationship to User'), 'rt-2');

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Could not save the change'));
    expect(screen.getByLabelText('Relationship to User')).toHaveValue('rt-1');
  });
});

describe('LastContactCell', () => {
  it('saves a picked date', async () => {
    render(
      <Wrapper>
        <LastContactCell personId="p-1" value="" />
      </Wrapper>
    );

    const input = screen.getByLabelText('Last Contact');
    await userEvent.type(input, '2026-08-10');

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(lastRequest().body).toEqual({ lastContact: '2026-08-10' });
  });

  it('sets today with the Today button', async () => {
    render(
      <Wrapper>
        <LastContactCell personId="p-1" value="2020-01-01" />
      </Wrapper>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Today' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(lastRequest().body.lastContact).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.getByLabelText('Last Contact')).toHaveValue(lastRequest().body.lastContact);
    expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument();
  });
});

describe('LocationCell', () => {
  it('saves the city when the field loses focus', async () => {
    render(
      <Wrapper>
        <LocationCell personId="p-1" city={null} country={null} />
      </Wrapper>
    );

    await userEvent.type(screen.getByLabelText('City'), '  Berlin ');
    await userEvent.tab();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(lastRequest().body).toEqual({ city: 'Berlin' });
  });

  it('does not save when nothing changed', async () => {
    render(
      <Wrapper>
        <LocationCell personId="p-1" city="Berlin" country="Germany" />
      </Wrapper>
    );

    await userEvent.click(screen.getByLabelText('City'));
    await userEvent.tab();
    await userEvent.tab();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the country code when a country is picked', async () => {
    render(
      <Wrapper>
        <LocationCell personId="p-1" city={null} country={null} />
      </Wrapper>
    );

    await userEvent.selectOptions(screen.getByLabelText('Country'), 'DE');

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(lastRequest().body).toEqual({ country: 'DE' });
  });

  it('shows a known country name as its code and keeps unknown text selectable', () => {
    const first = render(
      <Wrapper>
        <LocationCell personId="p-1" city="Berlin" country="Germany" />
      </Wrapper>
    );
    expect(screen.getByLabelText('Country')).toHaveValue('DE');

    first.unmount();
    render(
      <Wrapper>
        <LocationCell personId="p-2" city="Berlin" country="Atlantis" />
      </Wrapper>
    );
    expect(screen.getByLabelText('Country')).toHaveValue('Atlantis');
  });

  it('sends null when the country is emptied', async () => {
    render(
      <Wrapper>
        <LocationCell personId="p-1" city="Berlin" country="DE" />
      </Wrapper>
    );

    await userEvent.selectOptions(screen.getByLabelText('Country'), '');

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(lastRequest().body).toEqual({ country: null });
  });
});
