import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import GroupMembersView from '../../components/GroupMembersView';
import enMessages from '../../locales/en.json';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock('@/components/PersonPhoto', () => ({
  default: ({ name }: { name: string }) => <span data-testid="avatar">{name}</span>,
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/components/SearchIndexProvider', () => ({ useSearchIndex: () => ({ refreshIndex: vi.fn() }) }));

vi.mock('@/components/UnifiedNetworkGraph', () => ({
  default: ({ apiEndpoint }: { apiEndpoint?: string }) => <div data-testid="graph">{apiEndpoint}</div>,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

type Members = React.ComponentProps<typeof GroupMembersView>['members'];

const person = (id: string, name: string, overrides: Partial<Members[number]> = {}): Members[number] => ({
  id,
  name,
  middleName: null,
  surname: null,
  secondLastName: null,
  nickname: null,
  displayNameOverride: null,
  photo: null,
  lastContact: null,
  relationshipToUserId: null,
  addresses: [],
  connections: [],
  ...overrides,
});

const connection = (id: string, name: string, typeLabel: string | null) => ({
  id,
  name,
  middleName: null,
  surname: null,
  secondLastName: null,
  nickname: null,
  typeLabel,
});

const friend = { id: 'rt-friend', label: 'Friend', color: null };

const renderView = (members: Members) =>
  render(
    <Wrapper>
      <GroupMembersView groupId="g-1" members={members} relationshipTypes={[friend]} />
    </Wrapper>
  );

describe('GroupMembersView', () => {
  it('renders nothing for a group without members', () => {
    const { container } = renderView([]);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows a row per member with the editable cells', () => {
    renderView([person('p-1', 'Alice'), person('p-2', 'Bob')]);

    expect(screen.getAllByLabelText('Relationship to User')).toHaveLength(2);
    expect(screen.getAllByLabelText('Last Contact')).toHaveLength(2);
    expect(screen.getAllByLabelText('City')).toHaveLength(2);
  });

  it('lists members by name regardless of the order they arrive in', () => {
    renderView([person('p-2', 'Zoe'), person('p-1', 'Anna')]);

    const names = screen.getAllByRole('link').map((link) => link.textContent);
    expect(names).toEqual(['Anna', 'Zoe']);
  });

  it('shows connections with their type and links to the person', () => {
    renderView([
      person('p-1', 'Alice', { connections: [connection('x-1', 'Carol', 'Colleague')] }),
    ]);

    const link = screen.getByRole('link', { name: /Colleague:\s*Carol/ });
    expect(link).toHaveAttribute('href', '/people/x-1');
  });

  it('puts connections to other members first and highlights them', () => {
    renderView([
      person('p-1', 'Alice', {
        connections: [connection('x-1', 'Outsider', 'Friend'), connection('p-2', 'Bob', 'Sibling')],
      }),
      person('p-2', 'Bob'),
    ]);

    const row = screen.getByRole('link', { name: 'Alice' }).closest('tr')!;
    const connectionLinks = within(row).getAllByRole('link').slice(1);
    expect(connectionLinks.map((link) => link.getAttribute('href'))).toEqual(['/people/p-2', '/people/x-1']);
    expect(connectionLinks[0]).toHaveAttribute('title', 'Also in this group');
    expect(connectionLinks[1]).not.toHaveAttribute('title');
  });

  it('shows every relationship when a person is connected through two types', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderView([
      person('p-1', 'Alice', {
        connections: [connection('x-1', 'Carol', 'Friend'), connection('x-1', 'Carol', 'Colleague')],
      }),
    ]);

    expect(screen.getByRole('link', { name: /Friend:\s*Carol/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Colleague:\s*Carol/ })).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('shows a dash when a member has no connections', () => {
    renderView([person('p-1', 'Alice')]);

    const row = screen.getByRole('link', { name: 'Alice' }).closest('tr')!;
    expect(within(row).getAllByRole('cell').pop()).toHaveTextContent('\u2014');
  });

  it('folds connections beyond six into a count', () => {
    const many = Array.from({ length: 8 }, (_, i) => connection(`x-${i}`, `Person${i}`, null));
    renderView([person('p-1', 'Alice', { connections: many })]);

    expect(screen.getByText('+2 more')).toBeInTheDocument();
    expect(screen.queryByText('Person7')).not.toBeInTheDocument();
  });

  it('switches to the network of the group and back', async () => {
    renderView([person('p-1', 'Alice')]);

    expect(screen.queryByTestId('graph')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Network' }));

    expect(screen.getByTestId('graph')).toHaveTextContent('/api/dashboard/graph?includeGroupIds=g-1');
    expect(screen.queryByLabelText('Last Contact')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'List' }));

    expect(screen.queryByTestId('graph')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Last Contact')).toBeInTheDocument();
  });

  describe('selecting several members', () => {
    it('keeps the toolbar in place but disabled until someone is ticked', async () => {
      renderView([person('p-1', 'Alice'), person('p-2', 'Bob')]);
      expect(screen.getByRole('button', { name: 'Set Relationship' })).toBeDisabled();
      expect(screen.getByText(enMessages.groups.members.selectHint)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('checkbox', { name: 'Alice' }));
      expect(screen.getByText('1 selected')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Set Relationship' })).toBeEnabled();
    });

    it('ticks and unticks every member with the header box', async () => {
      renderView([person('p-1', 'Alice'), person('p-2', 'Bob'), person('p-3', 'Cleo')]);
      const all = screen.getByRole('checkbox', { name: 'Select all' });

      await userEvent.click(all);
      expect(screen.getByText('3 selected')).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Bob' })).toBeChecked();

      await userEvent.click(all);
      expect(screen.queryByText(/selected$/)).not.toBeInTheDocument();
    });

    it('clears the selection', async () => {
      renderView([person('p-1', 'Alice'), person('p-2', 'Bob')]);
      await userEvent.click(screen.getByRole('checkbox', { name: 'Alice' }));
      await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }));

      expect(screen.getByRole('checkbox', { name: 'Alice' })).not.toBeChecked();
      expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
    });

    it('sets the relationship of the ticked members in one request', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ affectedCount: 2 }) });
      vi.stubGlobal('fetch', fetchMock);
      refresh.mockClear();
      renderView([person('p-1', 'Alice'), person('p-2', 'Bob'), person('p-3', 'Cleo')]);

      await userEvent.click(screen.getByRole('checkbox', { name: 'Alice' }));
      await userEvent.click(screen.getByRole('checkbox', { name: 'Cleo' }));
      await userEvent.click(screen.getByRole('button', { name: 'Set Relationship' }));
      expect(screen.getByText('Set Relationship for 2 People')).toBeInTheDocument();
      await userEvent.selectOptions(screen.getByDisplayValue('Select relationship type...'), 'rt-friend');
      const [, confirm] = screen.getAllByRole('button', { name: 'Set Relationship' });
      await userEvent.click(confirm);

      expect(fetchMock).toHaveBeenCalledWith('/api/people/bulk', expect.objectContaining({ method: 'POST' }));
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body).toEqual({ action: 'setRelationship', personIds: ['p-1', 'p-3'], relationshipTypeId: 'rt-friend' });
      expect(refresh).toHaveBeenCalled();
      expect(screen.getByRole('checkbox', { name: 'Alice' })).not.toBeChecked();
      vi.unstubAllGlobals();
    });
  });
});
