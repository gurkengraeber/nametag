import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import RelationshipTypeMembersManager, {
  type TypePerson,
} from '../../components/RelationshipTypeMembersManager';
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

const person = (id: string, name: string, extra: Partial<TypePerson> = {}): TypePerson => ({
  id,
  name,
  surname: null,
  nickname: null,
  lastContact: null,
  groups: [],
  currentRelationship: null,
  ...extra,
});

const members = [
  person('m1', 'Mia', {
    lastContact: '2026-03-05T00:00:00.000Z',
    groups: [{ id: 'g1', name: 'Family', color: '#EF4444' }],
  }),
];
const available = [
  person('a1', 'Alice'),
  person('a2', 'Bob'),
  person('a3', 'Carl', { currentRelationship: 'Colleague' }),
];

const renderManager = (props: Partial<React.ComponentProps<typeof RelationshipTypeMembersManager>> = {}) =>
  render(
    <Wrapper>
      <RelationshipTypeMembersManager
        typeId="type-1"
        typeLabel="Friend"
        currentMembers={members}
        availablePeople={available}
        dateFormat="YMD"
        {...props}
      />
    </Wrapper>
  );

describe('RelationshipTypeMembersManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ updated: 2 }) } as Response)
    );
  });

  it('lists members with groups and last contact', () => {
    renderManager();

    expect(screen.getByText('People (1)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mia/ })).toHaveAttribute('href', '/people/m1');
    expect(screen.getAllByText('Family').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2026-03-05').length).toBeGreaterThan(0);
  });

  it('shows an empty hint when nobody has the relationship yet', () => {
    renderManager({ currentMembers: [] });
    expect(screen.getByText('Nobody is your Friend yet. Add people below.')).toBeInTheDocument();
  });

  it('removes a member through the API', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(screen.getByRole('button', { name: 'Remove Mia' }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/relationship-types/type-1/members/m1', { method: 'DELETE' })
    );
  });

  it('lists only people without a relationship in the checklist', () => {
    renderManager();

    expect(screen.getByText('People without a relationship to you (2)')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Alice/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Bob/ })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Carl/ })).not.toBeInTheDocument();
  });

  it('adds the ticked people in one request', async () => {
    const user = userEvent.setup();
    renderManager();

    expect(screen.getByRole('button', { name: 'Add selected' })).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: /Alice/ }));
    await user.click(screen.getByRole('checkbox', { name: /Bob/ }));
    await user.click(screen.getByRole('button', { name: 'Add 2 people as Friend' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/relationship-types/type-1/members/bulk');
    expect(JSON.parse(init.body)).toEqual({ personIds: ['a1', 'a2'] });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('selects everything with the select all box and narrows by search', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(screen.getByRole('checkbox', { name: 'Select all' }));
    expect(screen.getByRole('button', { name: 'Add 2 people as Friend' })).toBeEnabled();

    await user.click(screen.getByRole('checkbox', { name: 'Select all' }));
    await user.type(screen.getByPlaceholderText('Search these people'), 'ali');
    expect(screen.queryByRole('checkbox', { name: /Bob/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Select all matching' }));
    expect(screen.getByRole('button', { name: 'Add 1 person as Friend' })).toBeEnabled();
  });

  it('hides the checklist when everybody already has a relationship', () => {
    renderManager({ availablePeople: [available[2]] });
    expect(screen.queryByText(/People without a relationship/)).not.toBeInTheDocument();
  });
});
