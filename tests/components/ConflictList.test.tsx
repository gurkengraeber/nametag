import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import ConflictList from '@/components/ConflictList';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));

const base = { name: 'Ada', surname: 'Example', organization: 'Engines Ltd' };

function conflict(id: string, local: object, remote: object) {
  return {
    id,
    localVersion: JSON.stringify(local),
    remoteVersion: JSON.stringify(remote),
    createdAt: new Date('2026-11-01T10:00:00Z'),
    mapping: { person: { name: 'Ada', surname: id } },
  };
}

const conflicts = [
  conflict('adds', base, { ...base, jobTitle: 'Programmer' }),
  conflict('clash', base, { ...base, organization: 'Other Ltd' }),
];

describe('ConflictList', () => {
  const refresh = vi.fn();
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({ refresh });
    fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) } as Response));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('shows only the differing fields and collapses the rest', () => {
    render(<ConflictList conflicts={[conflicts[1]]} />);
    expect(screen.getByText('Other Ltd')).toBeDefined();
    expect(screen.getByText(/unchangedFields/).textContent).toContain('"count":2');
  });

  it('recommends the server when it only adds details', () => {
    render(<ConflictList conflicts={[conflicts[0]]} />);
    expect(screen.getByText('recommendServerAdds')).toBeDefined();
    expect(screen.getByRole('button', { name: /keepRemote.*recommended/ })).toBeDefined();
  });

  it('gives no recommendation when both sides changed the same field', () => {
    render(<ConflictList conflicts={[conflicts[1]]} />);
    expect(screen.getByText('recommendDiffers')).toBeDefined();
    expect(screen.queryByText(/recommended/)).toBeNull();
  });

  it('resolves one conflict with the chosen side', async () => {
    render(<ConflictList conflicts={[conflicts[1]]} />);
    fireEvent.click(screen.getByRole('button', { name: 'keepLocal' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe('/api/carddav/conflicts/clash/resolve');
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ resolution: 'keep_local' });
  });

  it('applies only the safe recommendations in bulk', async () => {
    render(<ConflictList conflicts={conflicts} />);
    fireEvent.click(screen.getByRole('button', { name: /applySafe/ }));
    await waitFor(() => expect(screen.getByText(/bulkDone/)).toBeDefined());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/carddav/conflicts/adds/resolve');
  });

  it('asks for confirmation before keeping all of one side', async () => {
    render(<ConflictList conflicts={conflicts} />);
    fireEvent.click(screen.getByRole('button', { name: 'keepAllRemote' }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/confirmAllRemoteBody/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /confirmAll \{/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const bodies = fetchMock.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string).resolution);
    expect(bodies).toEqual(['keep_remote', 'keep_remote']);
  });

  it('cancelling the confirmation resolves nothing', () => {
    render(<ConflictList conflicts={conflicts} />);
    fireEvent.click(screen.getByRole('button', { name: 'keepAllLocal' }));
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports failures in a bulk run and keeps going', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ error: 'Nope' }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) } as Response);
    render(<ConflictList conflicts={conflicts} />);
    fireEvent.click(screen.getByRole('button', { name: 'keepAllLocal' }));
    fireEvent.click(screen.getByRole('button', { name: /confirmAll \{/ }));
    await waitFor(() => screen.getByText(/bulkPartial/));
    expect(screen.getByText('Nope')).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
