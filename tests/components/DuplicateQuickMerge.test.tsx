import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import DuplicateQuickMerge from '../../components/DuplicateQuickMerge';
import enMessages from '../../locales/en.json';

const toastMocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMocks }));
vi.mock('@/components/SearchIndexProvider', () => ({
  useSearchIndex: () => ({ refreshIndex: vi.fn(), search: vi.fn(), isReady: false }),
}));

function apiPerson(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: 'Ann',
    surname: 'Lee',
    middleName: null,
    secondLastName: null,
    nickname: null,
    prefix: null,
    suffix: null,
    organization: null,
    jobTitle: null,
    gender: null,
    anniversary: null,
    lastContact: null,
    photo: null,
    notes: null,
    updatedAt: '2025-01-01T00:00:00.000Z',
    relationshipToUserId: null,
    relationshipToUser: null,
    phoneNumbers: [],
    emails: [],
    addresses: [],
    urls: [],
    imHandles: [],
    locations: [],
    customFields: [],
    customFieldValues: [],
    importantDates: [],
    groups: [],
    relationshipsFrom: [],
    relationshipsTo: [],
    ...overrides,
  };
}

const people: Record<string, unknown> = {
  a: apiPerson('a', { organization: 'Acme', jobTitle: 'Dev', phoneNumbers: [{ type: 'mobile', number: '111' }] }),
  b: apiPerson('b', {
    organization: 'Beta',
    updatedAt: '2025-06-01T00:00:00.000Z',
    phoneNumbers: [{ type: 'mobile', number: '222' }],
  }),
};

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe('DuplicateQuickMerge', () => {
  let mergeBody: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    mergeBody = undefined;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/people/merge') {
        mergeBody = JSON.parse(String(init?.body));
        return { ok: true, json: async () => ({ mergedInto: 'a' }) } as Response;
      }
      const id = url.split('/').pop() ?? '';
      return { ok: true, json: async () => ({ person: people[id] }) } as Response;
    }) as typeof fetch;
  });

  it('previews the merge and sends the preselected values in one step', async () => {
    const user = userEvent.setup();
    const onMerged = vi.fn();
    const onClose = vi.fn();
    render(
      <Wrapper>
        <DuplicateQuickMerge personAId="a" personBId="b" isOpen onClose={onClose} onMerged={onMerged} />
      </Wrapper>
    );

    expect(await screen.findByText('Ann Lee is kept.')).toBeInTheDocument();
    // B was edited later, so its organization is preselected and shown with its source
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText(/Added phones: 1/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Merge now' }));

    await waitFor(() => expect(onMerged).toHaveBeenCalledWith('a', 'b'));
    expect(mergeBody).toEqual({
      primaryId: 'a',
      secondaryId: 'b',
      fieldOverrides: { organization: 'Beta' },
    });
    expect(onClose).toHaveBeenCalled();
    expect(toastMocks.success).toHaveBeenCalled();
  });

  it('lets the user keep the other contact instead', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <DuplicateQuickMerge personAId="a" personBId="b" isOpen onClose={vi.fn()} onMerged={vi.fn()} />
      </Wrapper>
    );

    await screen.findByText('Ann Lee is kept.');
    await user.click(screen.getByRole('button', { name: 'Keep Ann Lee instead' }));
    await user.click(screen.getByRole('button', { name: 'Merge now' }));

    await waitFor(() => expect(mergeBody).toBeDefined());
    expect(mergeBody).toMatchObject({ primaryId: 'b', secondaryId: 'a' });
  });

  it('shows an error and stays open when the merge fails', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const baseFetch = global.fetch;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/people/merge') {
        return { ok: false, json: async () => ({ error: 'nope' }) } as Response;
      }
      return baseFetch(input, init);
    }) as typeof fetch;

    render(
      <Wrapper>
        <DuplicateQuickMerge personAId="a" personBId="b" isOpen onClose={onClose} onMerged={vi.fn()} />
      </Wrapper>
    );

    await screen.findByText('Ann Lee is kept.');
    await user.click(screen.getByRole('button', { name: 'Merge now' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to merge contacts');
    expect(onClose).not.toHaveBeenCalled();
  });
});
