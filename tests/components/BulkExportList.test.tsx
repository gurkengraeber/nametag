import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import BulkExportList from '@/components/BulkExportList';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));

function person(id: string, name: string, surname: string, email?: string) {
  return {
    id,
    name,
    surname,
    nickname: null,
    organization: null,
    jobTitle: null,
    groups: [],
    phoneNumbers: [],
    emails: email ? [{ type: 'HOME', email }] : [],
  };
}

const people = [
  person('p1', 'Ada', 'Example', 'ada@example.com'),
  person('p2', 'Grace', 'Sample'),
  person('p3', 'Linus', 'Demo'),
];

describe('BulkExportList', () => {
  const refresh = vi.fn();
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({ refresh });
    fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ exported: 1, skipped: 0, errors: 0, errorMessages: [] }),
      } as Response)
    );
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('selects only the people that match the search', () => {
    render(<BulkExportList people={people} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'grace' } });
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    const boxes = screen.getAllByRole('checkbox').slice(1) as HTMLInputElement[];
    expect(boxes.map((b) => b.checked)).toEqual([false, true, false]);
  });

  it('sends the selected people in batches and shows a summary', async () => {
    const many = Array.from({ length: 30 }, (_, i) => person(`m${i}`, `Person${i}`, 'Sample'));
    render(<BulkExportList people={many} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /exportSelected/ }));

    await waitFor(() => screen.getByText('exportComplete'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(first.personIds).toHaveLength(25);
    expect(screen.getByRole('link', { name: 'backToSettings' }).getAttribute('href')).toBe('/settings/carddav');
  });

  it('explains when sync is switched off', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ code: 'feature_disabled', error: 'Sync is disabled for this connection' }),
    } as Response);
    render(<BulkExportList people={people} />);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: /exportSelected/ }));
    await waitFor(() => screen.getByText('syncDisabled'));
  });

  it('refreshes the list when the user chooses to export more', async () => {
    render(<BulkExportList people={people} />);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: /exportSelected/ }));
    await waitFor(() => screen.getByText('exportComplete'));
    fireEvent.click(screen.getByRole('button', { name: 'exportMore' }));
    expect(refresh).toHaveBeenCalled();
  });
});
