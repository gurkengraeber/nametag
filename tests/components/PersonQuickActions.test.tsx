import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { toast } from 'sonner';
import enMessages from '../../locales/en.json';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mockRefresh }),
}));

import PersonQuickActions from '../../components/PersonQuickActions';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

const props = {
  personId: 'p-1',
  relationshipToUserId: 'rt-1',
  relationshipTypes: [
    { id: 'rt-1', label: 'Friend' },
    { id: 'rt-2', label: 'Colleague' },
  ],
  groups: [
    { id: 'g-1', name: 'Family', color: null },
    { id: 'g-2', name: 'Chess', color: null },
  ],
  selectedGroupIds: ['g-1'],
  notes: 'Likes tea',
  currentLastContact: null,
  dateFormat: 'MDY' as const,
};

function renderIt() {
  return render(
    <Wrapper>
      <PersonQuickActions {...props} />
    </Wrapper>
  );
}

function okResponse() {
  return { ok: true, json: async () => ({}) } as Response;
}

describe('PersonQuickActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue(okResponse());
  });

  it('changes the relationship with a partial PUT and confirms with a toast', async () => {
    const user = userEvent.setup();
    renderIt();

    await user.selectOptions(screen.getByLabelText('Relationship to you'), 'rt-2');

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/people/p-1',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ relationshipToUserId: 'rt-2' }) })
    );
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('can clear the relationship', async () => {
    const user = userEvent.setup();
    renderIt();

    await user.selectOptions(screen.getByLabelText('Relationship to you'), '');

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(vi.mocked(global.fetch).mock.calls[0][1]).toMatchObject({
      body: JSON.stringify({ relationshipToUserId: null }),
    });
  });

  it('reverts the relationship and reports when saving fails', async () => {
    const user = userEvent.setup();
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, json: async () => ({}) } as Response);
    renderIt();

    await user.selectOptions(screen.getByLabelText('Relationship to you'), 'rt-2');

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not update the relationship'));
    expect(screen.getByLabelText('Relationship to you')).toHaveValue('rt-1');
  });

  it('adds a group through the member endpoint', async () => {
    const user = userEvent.setup();
    renderIt();

    await user.click(screen.getByPlaceholderText(/create groups/i));
    await user.click(await screen.findByText('Chess'));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Groups updated'));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/groups/g-2/members',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ personId: 'p-1' }) })
    );
  });

  it('removes a group through the member endpoint', async () => {
    const user = userEvent.setup();
    renderIt();

    await user.click(screen.getByRole('button', { name: /remove family/i }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Groups updated'));
    expect(global.fetch).toHaveBeenCalledWith('/api/groups/g-1/members/p-1', { method: 'DELETE' });
  });

  it('appends a note to the existing notes', async () => {
    const user = userEvent.setup();
    renderIt();

    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await user.type(screen.getByLabelText('New note'), 'Moved to Hamburg');
    await user.click(screen.getByRole('button', { name: 'Add to notes' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Note added'));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/people/p-1',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ notes: 'Likes tea\n\nMoved to Hamburg' }) })
    );
    expect(screen.queryByLabelText('New note')).not.toBeInTheDocument();
  });

  it('builds a second note on the first one while the page still has the old notes', async () => {
    const user = userEvent.setup();
    renderIt();

    for (const text of ['Moved to Hamburg', 'Started chess']) {
      await user.click(screen.getByRole('button', { name: 'Add note' }));
      await user.type(screen.getByLabelText('New note'), text);
      await user.click(screen.getByRole('button', { name: 'Add to notes' }));
      await waitFor(() => expect(screen.queryByLabelText('New note')).not.toBeInTheDocument());
    }

    expect(global.fetch).toHaveBeenLastCalledWith(
      '/api/people/p-1',
      expect.objectContaining({
        body: JSON.stringify({ notes: 'Likes tea\n\nMoved to Hamburg\n\nStarted chess' }),
      })
    );
  });

  it('does not send an empty note', async () => {
    const user = userEvent.setup();
    renderIt();

    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await user.click(screen.getByRole('button', { name: 'Add to notes' }));

    expect(await screen.findByText('Write a note first')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
