import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import DuplicatesList from '../../components/DuplicatesList';
import type { DuplicateGroupDisplay } from '../../lib/duplicate-view';
import enMessages from '../../locales/en.json';

const toastMocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMocks }));
vi.mock('@/components/SearchIndexProvider', () => ({
  useSearchIndex: () => ({ refreshIndex: vi.fn(), search: vi.fn(), isReady: false }),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

const groups: DuplicateGroupDisplay[] = [
  {
    people: [
      { id: 'c', name: 'Bo', surname: null },
      { id: 'd', name: 'Bob', surname: null },
    ],
    similarity: 0.8,
    pairs: [{ personAId: 'c', personBId: 'd', similarity: 0.8, reasons: ['similarName'] }],
  },
  {
    people: [
      { id: 'a', name: 'Ann', surname: 'Lee' },
      { id: 'b', name: 'Ann', surname: 'Lee' },
    ],
    similarity: 0.97,
    pairs: [{ personAId: 'a', personBId: 'b', similarity: 0.97, reasons: ['sameName', 'sameEmail'] }],
  },
];

describe('DuplicatesList (all contacts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }) as Response) as typeof fetch;
  });

  it('sorts suggestions by confidence and explains why they match', () => {
    render(<Wrapper><DuplicatesList groups={groups} /></Wrapper>);

    expect(screen.getByText('2 open suggestions')).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings[0]).toMatch(/^Very likely the same person/);
    expect(headings[1]).toMatch(/^Possibly the same person/);
    expect(screen.getByText('Why: same name and same email address')).toBeInTheDocument();
    expect(screen.getByText('Why: similar name')).toBeInTheDocument();
  });

  it('removes a pair after "Not duplicates" and offers to undo it', async () => {
    const user = userEvent.setup();
    render(<Wrapper><DuplicatesList groups={groups} /></Wrapper>);

    await user.click(screen.getAllByRole('button', { name: 'Not duplicates' })[0]);

    await waitFor(() => expect(screen.getByText('1 open suggestion')).toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/people/duplicates/dismiss',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ personAId: 'a', personBId: 'b' }) })
    );

    const options = toastMocks.success.mock.calls[0][1] as { action: { label: string; onClick: () => Promise<void> } };
    expect(options.action.label).toBe('Undo');
    await options.action.onClick();
    expect(global.fetch).toHaveBeenLastCalledWith(
      '/api/people/duplicates/dismiss',
      expect.objectContaining({ method: 'DELETE' })
    );
    await waitFor(() => expect(screen.getByText('2 open suggestions')).toBeInTheDocument());
  });

  it('links to the full review page and has a one-step merge', () => {
    render(<Wrapper><DuplicatesList groups={groups} /></Wrapper>);
    expect(screen.getAllByRole('link', { name: 'Review' })[0]).toHaveAttribute(
      'href',
      '/people/merge?primary=a&secondary=b'
    );
    expect(screen.getAllByRole('button', { name: 'Merge now' })).toHaveLength(2);
  });

  it('shows a friendly message when there is nothing to review', () => {
    render(<Wrapper><DuplicatesList groups={[]} /></Wrapper>);
    expect(screen.getByText('No duplicate contacts found.')).toBeInTheDocument();
    expect(screen.getByText(/Everything looks tidy/)).toBeInTheDocument();
  });
});
