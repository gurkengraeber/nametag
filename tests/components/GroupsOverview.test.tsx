import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import GroupsOverview, { type GroupOverviewItem } from '../../components/GroupsOverview';
import enMessages from '../../locales/en.json';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh })),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

const groups: GroupOverviewItem[] = [
  { id: 'g1', name: 'Family', description: null, color: '#EF4444', memberCount: 6, preview: ['Anna', 'Ben', 'Clara', 'Dan'] },
  { id: 'g2', name: 'Work', description: 'Office people', color: '#F97316', memberCount: 1, preview: ['Eva'] },
  { id: 'g3', name: 'Chess club', description: null, color: '#22C55E', memberCount: 0, preview: [] },
];

const names = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);

describe('GroupsOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ group: { id: 'new' } }) } as Response)
    );
  });

  it('shows member counts and a preview of the first members', () => {
    render(<Wrapper><GroupsOverview groups={groups} canCreate /></Wrapper>);

    expect(screen.getByText('6 members')).toBeInTheDocument();
    expect(screen.getByText('1 member')).toBeInTheDocument();
    expect(screen.getByText('No members yet')).toBeInTheDocument();
    expect(screen.getByText('Anna, Ben, Clara, Dan +2 more')).toBeInTheDocument();
  });

  it('sorts by name by default and by size on request', async () => {
    const user = userEvent.setup();
    render(<Wrapper><GroupsOverview groups={groups} canCreate /></Wrapper>);

    expect(names()).toEqual(['Chess club', 'Family', 'Work']);

    await user.selectOptions(screen.getByLabelText('Sort groups'), 'size');
    expect(names()).toEqual(['Family', 'Work', 'Chess club']);
  });

  it('filters by search and offers to clear it', async () => {
    const user = userEvent.setup();
    render(<Wrapper><GroupsOverview groups={groups} canCreate /></Wrapper>);

    await user.type(screen.getByPlaceholderText('Search groups'), 'office');
    expect(names()).toEqual(['Work']);

    await user.clear(screen.getByPlaceholderText('Search groups'));
    await user.type(screen.getByPlaceholderText('Search groups'), 'zzz');
    expect(screen.getByText('No groups match "zzz".')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(names()).toHaveLength(3);
  });

  it('creates a group from the quick add field with Enter', async () => {
    const user = userEvent.setup();
    render(<Wrapper><GroupsOverview groups={groups} canCreate /></Wrapper>);

    await user.type(screen.getByLabelText('Name of a new group'), 'Neighbors{Enter}');

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/groups');
    const body = JSON.parse(init.body);
    expect(body.name).toBe('Neighbors');
    expect(body.color).toMatch(/^#[0-9a-f]{6}$/i);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.getByLabelText('Name of a new group')).toHaveValue('');
  });

  it('does not submit an empty name', async () => {
    render(<Wrapper><GroupsOverview groups={groups} canCreate /></Wrapper>);
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('warns about a very similar group name', async () => {
    const user = userEvent.setup();
    render(<Wrapper><GroupsOverview groups={groups} canCreate /></Wrapper>);

    await user.type(screen.getByLabelText('Name of a new group'), 'Familys');
    expect(screen.getByRole('status')).toHaveTextContent('Looks similar to the existing group "Family"');
  });

  it('hides quick add and explains the limit when no more groups can be created', () => {
    render(<Wrapper><GroupsOverview groups={groups} canCreate={false} limit={3} /></Wrapper>);

    expect(screen.queryByLabelText('Name of a new group')).not.toBeInTheDocument();
    expect(screen.getByText(/reached the limit of 3 groups/)).toBeInTheDocument();
  });

  it('offers starter groups on an empty list and creates one with a tap', async () => {
    const user = userEvent.setup();
    render(<Wrapper><GroupsOverview groups={[]} canCreate /></Wrapper>);

    expect(screen.getByText('No groups yet')).toBeInTheDocument();
    const suggestions = screen.getByText('Start with a few common groups, one tap each:').parentElement as HTMLElement;
    await user.click(within(suggestions).getByRole('button', { name: 'Family' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.name).toBe('Family');
  });
});
