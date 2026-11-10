/**
 * Tests for the CardDAV import assistant: choose, assign, import, summary.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import ImportContactsList from '@/components/ImportContactsList';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/components/SearchIndexProvider', () => ({
  useSearchIndex: () => ({ refreshIndex: vi.fn(), search: vi.fn(), isReady: false }),
}));

function makeImport(id: string, fullName: string, extra = '') {
  const [first, last] = fullName.split(' ');
  return {
    id,
    uid: `uid-${id}`,
    href: `href-${id}`,
    vCardData: `BEGIN:VCARD\nVERSION:3.0\nFN:${fullName}\nN:${last};${first};;;\n${extra}END:VCARD`,
    displayName: fullName,
    discoveredAt: new Date(),
  };
}

const mockPendingImports = [
  makeImport('import-1', 'Ada Example', 'ORG:Engines Ltd\nEMAIL:ada@example.com\n'),
  makeImport('import-2', 'Grace Sample', 'EMAIL:grace@example.org\n'),
  makeImport('import-3', 'Linus Demo'),
];

const mockGroups = [{ id: 'group-1', name: 'Friends', color: '#FF0000' }];
const mockRelationshipTypes = [
  { id: 'rel-1', label: 'Friend', color: '#00FF00' },
  { id: 'rel-2', label: 'Family', color: '#0000FF' },
];

function renderList(props: Partial<React.ComponentProps<typeof ImportContactsList>> = {}) {
  return render(
    <ImportContactsList
      pendingImports={mockPendingImports}
      groups={mockGroups}
      relationshipTypes={mockRelationshipTypes}
      {...props}
    />
  );
}

const rowCheckbox = (name: string) =>
  screen.getByRole('checkbox', { name: new RegExp(name) });

function bodyOfCall(fetchMock: ReturnType<typeof vi.fn>, call = 0) {
  const init = fetchMock.mock.calls[call][1] as RequestInit;
  return JSON.parse(init.body as string);
}

describe('ImportContactsList', () => {
  const mockPush = vi.fn();
  const mockRefresh = vi.fn();
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({ push: mockPush, refresh: mockRefresh });
    window.scrollTo = vi.fn();
    fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ imported: 1, updated: 0, skipped: 0, errors: 0, errorMessages: [] }),
      } as Response)
    );
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('Choosing contacts', () => {
    it('disables continue until a contact is selected', () => {
      renderList();
      expect(screen.getByRole('button', { name: /continueWith/ })).toBeDisabled();
      fireEvent.click(rowCheckbox('Ada Example'));
      expect(screen.getByRole('button', { name: /continueWith/ })).toBeEnabled();
    });

    it('filters the list with the search field', () => {
      renderList();
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'grace' } });
      expect(screen.queryByText('Ada Example')).toBeNull();
      expect(screen.getByText('Grace Sample')).toBeDefined();
    });

    it('searches in company and email too', () => {
      renderList();
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'engines' } });
      expect(screen.getByText('Ada Example')).toBeDefined();
      expect(screen.queryByText('Linus Demo')).toBeNull();
    });

    it('shows a way back when nothing matches', () => {
      renderList();
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });
      expect(screen.getByText('noMatches')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'clearSearch' }));
      expect(screen.getByText('Ada Example')).toBeDefined();
    });

    it('selects only the contacts that are shown', () => {
      renderList();
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ada' } });
      // First checkbox is the "select all shown" box in the toolbar
      fireEvent.click(screen.getAllByRole('checkbox')[0]);
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
      expect((rowCheckbox('Ada Example') as HTMLInputElement).checked).toBe(true);
      expect((rowCheckbox('Grace Sample') as HTMLInputElement).checked).toBe(false);
      expect((rowCheckbox('Linus Demo') as HTMLInputElement).checked).toBe(false);
    });

    it('filters by already existing contacts', () => {
      renderList({ existingUids: ['uid-import-2'] });
      fireEvent.click(screen.getByRole('button', { name: 'filterExisting' }));
      expect(screen.getByText('Grace Sample')).toBeDefined();
      expect(screen.queryByText('Ada Example')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'filterNew' }));
      expect(screen.queryByText('Grace Sample')).toBeNull();
      expect(screen.getByText('Ada Example')).toBeDefined();
    });
  });

  describe('Importing', () => {
    it('goes through assign and import and shows a summary instead of redirecting', async () => {
      renderList();
      fireEvent.click(rowCheckbox('Ada Example'));
      fireEvent.click(screen.getByRole('button', { name: /continueWith/ }));
      fireEvent.click(screen.getByRole('button', { name: /importSelected/ }));

      await waitFor(() => expect(screen.getByText('importComplete')).toBeDefined());
      expect(mockPush).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe('/api/carddav/import');
      expect(bodyOfCall(fetchMock).importIds).toEqual(['import-1']);
      expect(screen.getByRole('link', { name: 'openPeople' }).getAttribute('href')).toBe('/people');
    });

    it('offers the settings link after a CardDAV import only', async () => {
      const { unmount } = renderList();
      fireEvent.click(rowCheckbox('Ada Example'));
      fireEvent.click(screen.getByRole('button', { name: /continueWith/ }));
      fireEvent.click(screen.getByRole('button', { name: /importSelected/ }));
      await waitFor(() => screen.getByText('importComplete'));
      expect(screen.getByRole('link', { name: 'backToSettings' }).getAttribute('href')).toBe('/settings/carddav');
      unmount();

      renderList({ isFileImport: true });
      fireEvent.click(rowCheckbox('Ada Example'));
      fireEvent.click(screen.getByRole('button', { name: /continueWith/ }));
      fireEvent.click(screen.getByRole('button', { name: /importSelected/ }));
      await waitFor(() => screen.getByText('importComplete'));
      expect(screen.queryByRole('link', { name: 'backToSettings' })).toBeNull();
    });

    it('sends the global relationship and groups', async () => {
      renderList();
      fireEvent.click(rowCheckbox('Ada Example'));
      fireEvent.click(screen.getByRole('button', { name: /continueWith/ }));

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'rel-1' } });
      fireEvent.focus(screen.getByPlaceholderText('placeholder'));
      await waitFor(() => fireEvent.click(screen.getByText('Friends')));

      fireEvent.click(screen.getByRole('button', { name: /importSelected/ }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const body = bodyOfCall(fetchMock);
      expect(body.globalRelationshipTypeId).toBe('rel-1');
      expect(body.globalGroupIds).toEqual(['group-1']);
    });

    it('imports a long selection in several requests', async () => {
      const many = Array.from({ length: 30 }, (_, i) => makeImport(`m-${i}`, `Person${i} Sample`));
      renderList({ pendingImports: many });
      fireEvent.click(screen.getAllByRole('checkbox')[0]);
      fireEvent.click(screen.getByRole('button', { name: /continueWith/ }));
      fireEvent.click(screen.getByRole('button', { name: /importSelected/ }));

      await waitFor(() => screen.getByText('importComplete'));
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(bodyOfCall(fetchMock, 0).importIds).toHaveLength(25);
      expect(bodyOfCall(fetchMock, 1).importIds).toHaveLength(5);
      // 1 imported per mocked response, summed over both requests
      expect(screen.getByText('statImported').parentElement?.textContent).toContain('2');
    });

    it('keeps the partial result and shows the error when a later batch fails', async () => {
      const many = Array.from({ length: 30 }, (_, i) => makeImport(`m-${i}`, `Person${i} Sample`));
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ imported: 25, updated: 0, skipped: 0, errors: 0, errorMessages: [] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Server exploded' }),
        } as Response);
      renderList({ pendingImports: many });
      fireEvent.click(screen.getAllByRole('checkbox')[0]);
      fireEvent.click(screen.getByRole('button', { name: /continueWith/ }));
      fireEvent.click(screen.getByRole('button', { name: /importSelected/ }));

      await waitFor(() => screen.getByText('Server exploded'));
      expect(screen.getByText(/notProcessed/)).toBeDefined();
      expect(screen.getByText('statImported').parentElement?.textContent).toContain('25');
    });

    it('explains a lost connection in our own words instead of the browser message', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      renderList();
      fireEvent.click(rowCheckbox('Ada Example'));
      fireEvent.click(screen.getByRole('button', { name: /continueWith/ }));
      fireEvent.click(screen.getByRole('button', { name: /importSelected/ }));

      await waitFor(() => screen.getByText('importFailed'));
      expect(screen.queryByText('Failed to fetch')).toBeNull();
      expect(screen.getByText(/notProcessed/)).toBeDefined();
    });

    it('lists the per contact error messages', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ imported: 0, updated: 0, skipped: 0, errors: 1, errorMessages: ['Failed to import Ada Example: boom'] }),
      } as Response);
      renderList();
      fireEvent.click(rowCheckbox('Ada Example'));
      fireEvent.click(screen.getByRole('button', { name: /continueWith/ }));
      fireEvent.click(screen.getByRole('button', { name: /importSelected/ }));
      await waitFor(() => screen.getByText('Failed to import Ada Example: boom'));
    });

    it('explains a plan limit', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ code: 'plan_limit_reached', params: { available: 2, requested: 5 } }),
      } as Response);
      renderList();
      fireEvent.click(rowCheckbox('Ada Example'));
      fireEvent.click(screen.getByRole('button', { name: /continueWith/ }));
      fireEvent.click(screen.getByRole('button', { name: /importSelected/ }));
      await waitFor(() => screen.getByText(/importLimitExceeded/));
    });
  });

  describe('Assign step', () => {
    it('shows how many selected contacts already exist and can update them all', async () => {
      renderList({ existingUids: ['uid-import-2'] });
      fireEvent.click(rowCheckbox('Ada Example'));
      fireEvent.click(rowCheckbox('Grace Sample'));
      fireEvent.click(screen.getByRole('button', { name: /continueWith/ }));

      expect(screen.getByText(/reviewBreakdown/).textContent).toContain('"existingCount":1');
      fireEvent.click(screen.getByRole('checkbox', { name: /updateAllExisting/ }));
      fireEvent.click(screen.getByRole('button', { name: /importSelected/ }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      expect(bodyOfCall(fetchMock).updateExistingIds).toEqual(['import-2']);
    });

    it('goes back to the list without losing the selection', () => {
      renderList();
      fireEvent.click(rowCheckbox('Ada Example'));
      fireEvent.click(screen.getByRole('button', { name: /continueWith/ }));
      fireEvent.click(screen.getByRole('button', { name: 'back' }));
      expect((rowCheckbox('Ada Example') as HTMLInputElement).checked).toBe(true);
    });

    it('does not offer a relationship select without relationship types', () => {
      renderList({ relationshipTypes: [] });
      fireEvent.click(rowCheckbox('Ada Example'));
      fireEvent.click(screen.getByRole('button', { name: /continueWith/ }));
      expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    });
  });

  describe('Cancel behavior', () => {
    it('navigates to /settings/carddav when canceling a CardDAV import', () => {
      renderList({ isFileImport: false });
      fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
      expect(mockPush).toHaveBeenCalledWith('/settings/carddav');
    });

    it('navigates to /people when canceling a file import', () => {
      renderList({ isFileImport: true });
      fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
      expect(mockPush).toHaveBeenCalledWith('/people');
    });

    it('asks before leaving with a selection', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderList();
      fireEvent.click(rowCheckbox('Ada Example'));
      fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
      expect(confirmSpy).toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    it('leaves when the user confirms', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderList({ isFileImport: true });
      fireEvent.click(rowCheckbox('Ada Example'));
      fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
      expect(mockPush).toHaveBeenCalledWith('/people');
      confirmSpy.mockRestore();
    });
  });

  it('shows the step labels', () => {
    renderList();
    const steps = screen.getByRole('list');
    expect(within(steps).getByText('stepConnect')).toBeDefined();
    expect(within(steps).getByText('stepChoose')).toBeDefined();
    expect(within(steps).getByText('stepAssign')).toBeDefined();
    expect(within(steps).getByText('stepDone')).toBeDefined();
  });
});
