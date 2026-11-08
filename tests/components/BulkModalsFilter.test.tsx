import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import BulkDeleteModal from '../../components/BulkDeleteModal';
import enMessages from '../../locales/en.json';

vi.mock('@/components/SearchIndexProvider', () => ({
  useSearchIndex: () => ({ refreshIndex: vi.fn() }),
}));

const fetchMock = vi.fn();

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

const jsonResponse = (data: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve(data) });

const requestBodies = (url: string) =>
  fetchMock.mock.calls
    .filter(([calledUrl]) => calledUrl === url)
    .map(([, init]) => JSON.parse(init.body));

const renderModal = (props: Partial<React.ComponentProps<typeof BulkDeleteModal>>) =>
  render(
    <Wrapper>
      <BulkDeleteModal
        isOpen
        onClose={vi.fn()}
        selectedIds={['p1']}
        selectAll={false}
        selectedNames={['Alice']}
        totalCount={2}
        onSuccess={vi.fn()}
        {...props}
      />
    </Wrapper>
  );

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => jsonResponse({ orphans: [], hasCardDavSync: false }));
  vi.stubGlobal('fetch', fetchMock);
});

describe('BulkDeleteModal with the filters of the people list', () => {
  it('sends the active filter when looking for orphans of all filtered people', async () => {
    renderModal({ selectAll: true, filter: { group: 'g1', cf: 'pet:Dog' } });

    await waitFor(() => expect(requestBodies('/api/people/bulk/orphans')).toHaveLength(1));
    expect(requestBodies('/api/people/bulk/orphans')[0]).toEqual({
      selectAll: true,
      filter: { group: 'g1', cf: 'pet:Dog' },
    });
  });

  it('sends the same filter with the delete request', async () => {
    renderModal({ selectAll: true, filter: { relationship: 'none' } });
    await waitFor(() => expect(requestBodies('/api/people/bulk/orphans')).toHaveLength(1));

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(requestBodies('/api/people/bulk')).toHaveLength(1));
    expect(requestBodies('/api/people/bulk')[0]).toMatchObject({
      action: 'delete',
      selectAll: true,
      filter: { relationship: 'none' },
    });
  });

  it('sends the chosen ids and no filter when people were picked one by one', async () => {
    renderModal({ selectAll: false, selectedIds: ['p1', 'p2'], filter: { group: 'g1' } });

    await waitFor(() => expect(requestBodies('/api/people/bulk/orphans')).toHaveLength(1));
    expect(requestBodies('/api/people/bulk/orphans')[0]).toEqual({ personIds: ['p1', 'p2'] });
  });
});
