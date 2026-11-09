import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { toast } from 'sonner';
import RelationshipBuilder from '../../components/RelationshipBuilder';
import enMessages from '../../locales/en.json';
import type { BuilderLink, BuilderPerson, BuilderType } from '../../lib/relationship-builder';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/components/PersonPhoto', () => ({
  default: ({ name }: { name: string }) => <div data-testid="avatar">{name[0]}</div>,
}));

const person = (id: string, displayName: string, extra: Partial<BuilderPerson> = {}): BuilderPerson => ({
  id,
  displayName,
  secondary: null,
  nickname: null,
  photo: null,
  relationshipLabel: null,
  groupIds: [],
  ...extra,
});

const PEOPLE: BuilderPerson[] = [
  person('anna', 'Anna Schmidt', { relationshipLabel: 'Friend', groupIds: ['g1'] }),
  person('ben', 'Ben Mueller'),
  person('cara', 'Cara Dupont', { groupIds: ['g1'] }),
];

const TYPES: BuilderType[] = [
  { id: 'parent', name: 'PARENT', label: 'Parent', color: '#F59E0B', inverseId: 'child' },
  { id: 'child', name: 'CHILD', label: 'Child', color: '#F59E0B', inverseId: 'parent' },
  { id: 'friend', name: 'FRIEND', label: 'Friend', color: '#3B82F6', inverseId: 'friend' },
];

function renderBuilder(initialLinks: BuilderLink[] = []) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <RelationshipBuilder
        userId="u1"
        people={PEOPLE}
        groups={[{ id: 'g1', name: 'Family' }]}
        types={TYPES}
        initialLinks={initialLinks}
      />
    </NextIntlClientProvider>
  );
}

const card = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

function mockFetch() {
  let nextId = 0;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'DELETE') {
      return new Response(JSON.stringify({ message: 'ok' }), { status: 200 });
    }
    return new Response(JSON.stringify({ relationship: { id: `rel-${++nextId}` } }), { status: 201 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function lastToastAction(): { label: string; onClick: () => void } {
  const calls = vi.mocked(toast.success).mock.calls;
  const options = calls[calls.length - 1][1] as { action: { label: string; onClick: () => void } };
  return options.action;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  // jsdom does not implement scrolling; dragging near the top edge auto-scrolls.
  vi.stubGlobal('scrollBy', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('RelationshipBuilder tap flow', () => {
  it('links two people by tapping, shows what happened and updates the counts', async () => {
    const fetchMock = mockFetch();
    renderBuilder();

    fireEvent.click(card('Anna Schmidt'));
    expect(screen.getByRole('status')).toHaveTextContent('Anna Schmidt is selected');
    expect(card('Anna Schmidt')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(card('Ben Mueller'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Anna Schmidt → Ben Mueller')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Parent' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/relationships');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      personId: 'anna',
      relatedPersonId: 'ben',
      relationshipTypeId: 'parent',
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith(
      "Anna Schmidt is Ben Mueller's Parent, Ben Mueller is Anna Schmidt's Child",
      expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) })
    );
    expect(card('Anna Schmidt')).toHaveTextContent('1 connection');
    expect(card('Ben Mueller')).toHaveTextContent('1 connection');
    expect(card('Cara Dupont')).toHaveTextContent('No connections');
    expect(screen.getByText('Just linked')).toBeInTheDocument();
    expect(card('Anna Schmidt')).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps the filter while the state updates', async () => {
    mockFetch();
    renderBuilder();
    fireEvent.change(screen.getByLabelText('Search people'), { target: { value: 'a' } });
    fireEvent.change(screen.getByLabelText('Group'), { target: { value: 'g1' } });
    expect(screen.queryByRole('button', { name: /^Ben Mueller/ })).not.toBeInTheDocument();

    fireEvent.click(card('Anna Schmidt'));
    fireEvent.click(card('Cara Dupont'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Friend' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Search people')).toHaveValue('a');
    expect(screen.queryByRole('button', { name: /^Ben Mueller/ })).not.toBeInTheDocument();
    expect(card('Cara Dupont')).toHaveTextContent('1 connection');
  });

  it('undoes through the toast with a DELETE and restores the counts', async () => {
    const fetchMock = mockFetch();
    renderBuilder();

    fireEvent.click(card('Anna Schmidt'));
    fireEvent.click(card('Ben Mueller'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Parent' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());

    await act(async () => {
      lastToastAction().onClick();
    });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/relationships/rel-1', { method: 'DELETE' })
    );
    await waitFor(() => expect(card('Anna Schmidt')).toHaveTextContent('No connections'));
    expect(card('Ben Mueller')).toHaveTextContent('No connections');
    expect(screen.queryByText('Just linked')).not.toBeInTheDocument();
  });

  it('undoes from the list of recent links', async () => {
    const fetchMock = mockFetch();
    renderBuilder();

    fireEvent.click(card('Anna Schmidt'));
    fireEvent.click(card('Ben Mueller'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Friend' }));
    await screen.findByText('Just linked');

    fireEvent.click(screen.getByRole('button', { name: /^Undo:/ }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/relationships/rel-1', { method: 'DELETE' })
    );
    await waitFor(() => expect(screen.queryByText('Just linked')).not.toBeInTheDocument());
  });

  it('shows existing connections, disables those types and warns that undo is limited', () => {
    mockFetch();
    renderBuilder([
      { id: 'l1', personId: 'anna', relatedPersonId: 'ben', relationshipTypeId: 'friend' },
      { id: 'l2', personId: 'ben', relatedPersonId: 'anna', relationshipTypeId: 'friend' },
    ]);

    fireEvent.click(card('Anna Schmidt'));
    fireEvent.click(card('Ben Mueller'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Already connected: Anna Schmidt is Ben Mueller's Friend/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Friend, already linked' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Parent' })).toBeEnabled();
    expect(within(dialog).getByText(/cannot be undone with one tap/)).toBeInTheDocument();
  });

  it('offers no one-tap undo when the pair already had links', async () => {
    mockFetch();
    renderBuilder([
      { id: 'l1', personId: 'anna', relatedPersonId: 'ben', relationshipTypeId: 'friend' },
      { id: 'l2', personId: 'ben', relatedPersonId: 'anna', relationshipTypeId: 'friend' },
    ]);
    fireEvent.click(card('Anna Schmidt'));
    fireEvent.click(card('Ben Mueller'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Parent' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const options = vi.mocked(toast.success).mock.calls[0][1] as { action?: unknown };
    expect(options.action).toBeUndefined();
  });

  it('does nothing when the same card is tapped twice, and Escape cancels the selection', () => {
    renderBuilder();
    fireEvent.click(card('Anna Schmidt'));
    fireEvent.click(card('Anna Schmidt'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(card('Anna Schmidt'));
    expect(screen.getByRole('status')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('closes the picker with Escape without linking anyone', () => {
    const fetchMock = mockFetch();
    renderBuilder();
    fireEvent.click(card('Anna Schmidt'));
    fireEvent.click(card('Ben Mueller'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows an error and keeps the picker open when the API fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'nope', code: 'internal_error' }), { status: 500 }))
    );
    renderBuilder();
    fireEvent.click(card('Anna Schmidt'));
    fireEvent.click(card('Ben Mueller'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Friend' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('That did not work. Please try again.'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(card('Anna Schmidt')).toHaveTextContent('No connections');
  });

  it('puts the most recently used type first on the next dialog', async () => {
    mockFetch();
    renderBuilder();
    fireEvent.click(card('Anna Schmidt'));
    fireEvent.click(card('Ben Mueller'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Friend' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    expect(JSON.parse(window.localStorage.getItem('nametag:connect-recent-types:u1') ?? '[]')).toEqual(['friend']);

    fireEvent.click(card('Cara Dupont'));
    fireEvent.click(card('Ben Mueller'));
    const chips = within(screen.getByRole('group', { name: 'Relationship types' })).getAllByRole('button');
    expect(chips[0]).toHaveTextContent('Friend');
  });
});

describe('RelationshipBuilder brush mode', () => {
  it('links immediately with the brush type and no dialog, and can be stopped', async () => {
    const fetchMock = mockFetch();
    renderBuilder();

    fireEvent.click(screen.getByRole('button', { name: 'Friend' }));
    expect(screen.getByRole('status')).toHaveTextContent('Brush mode on: Friend');

    fireEvent.click(card('Anna Schmidt'));
    fireEvent.click(card('Ben Mueller'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      personId: 'anna',
      relatedPersonId: 'ben',
      relationshipTypeId: 'friend',
    });

    fireEvent.click(card('Anna Schmidt'));
    fireEvent.click(card('Cara Dupont'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(screen.queryByText(/Brush mode on/)).not.toBeInTheDocument();
  });

  it('does not post a pair that already has the brush type', async () => {
    const fetchMock = mockFetch();
    renderBuilder([
      { id: 'l1', personId: 'anna', relatedPersonId: 'ben', relationshipTypeId: 'friend' },
      { id: 'l2', personId: 'ben', relatedPersonId: 'anna', relationshipTypeId: 'friend' },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Friend' }));
    fireEvent.click(card('Anna Schmidt'));
    fireEvent.click(card('Ben Mueller'));
    await waitFor(() => expect(toast.info).toHaveBeenCalled());
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('RelationshipBuilder dragging', () => {
  function pointer(type: string, target: Element | Window, init: PointerEventInit) {
    fireEvent(target, new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, ...init }));
  }

  function underPointer(element: Element | null) {
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => element),
    });
  }

  afterEach(() => {
    Reflect.deleteProperty(document, 'elementFromPoint');
  });

  it('drops one card on another with the mouse and opens the picker', async () => {
    mockFetch();
    renderBuilder();
    const anna = card('Anna Schmidt');
    const ben = card('Ben Mueller');

    pointer('pointerdown', anna, { pointerType: 'mouse', button: 0, clientX: 10, clientY: 10 });
    // Below the threshold: still a click, no ghost.
    pointer('pointermove', window, { pointerType: 'mouse', clientX: 12, clientY: 12 });
    expect(screen.queryByTestId('drag-ghost')).not.toBeInTheDocument();

    underPointer(ben);
    pointer('pointermove', window, { pointerType: 'mouse', clientX: 80, clientY: 60 });
    expect(screen.getByTestId('drag-ghost')).toBeInTheDocument();
    expect(ben.className).toContain('border-primary');

    pointer('pointerup', window, { pointerType: 'mouse', clientX: 80, clientY: 60 });
    expect(screen.queryByTestId('drag-ghost')).not.toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Anna Schmidt → Ben Mueller')).toBeInTheDocument();
  });

  it('applies the brush on drop without a dialog', async () => {
    const fetchMock = mockFetch();
    renderBuilder();
    fireEvent.click(screen.getByRole('button', { name: 'Friend' }));
    const anna = card('Anna Schmidt');
    const cara = card('Cara Dupont');

    pointer('pointerdown', anna, { pointerType: 'mouse', button: 0, clientX: 10, clientY: 10 });
    underPointer(cara);
    pointer('pointermove', window, { pointerType: 'mouse', clientX: 90, clientY: 90 });
    pointer('pointerup', window, { pointerType: 'mouse', clientX: 90, clientY: 90 });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      personId: 'anna',
      relatedPersonId: 'cara',
    });
  });

  it('keeps the browser from starting a native image drag on a card', () => {
    renderBuilder();
    const notPrevented = fireEvent.dragStart(card('Anna Schmidt'));
    expect(notPrevented).toBe(false);
  });

  it('ignores a drop on the same card or on empty space', () => {
    mockFetch();
    renderBuilder();
    const anna = card('Anna Schmidt');

    pointer('pointerdown', anna, { pointerType: 'mouse', button: 0, clientX: 10, clientY: 10 });
    underPointer(anna);
    pointer('pointermove', window, { pointerType: 'mouse', clientX: 40, clientY: 40 });
    pointer('pointerup', window, { pointerType: 'mouse', clientX: 40, clientY: 40 });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    pointer('pointerdown', anna, { pointerType: 'mouse', button: 0, clientX: 10, clientY: 10 });
    underPointer(document.body);
    pointer('pointermove', window, { pointerType: 'mouse', clientX: 40, clientY: 40 });
    pointer('pointerup', window, { pointerType: 'mouse', clientX: 40, clientY: 40 });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not select the card for the click that ends a drag', () => {
    renderBuilder();
    const anna = card('Anna Schmidt');
    pointer('pointerdown', anna, { pointerType: 'mouse', button: 0, clientX: 10, clientY: 10 });
    underPointer(anna);
    pointer('pointermove', window, { pointerType: 'mouse', clientX: 40, clientY: 40 });
    pointer('pointerup', window, { pointerType: 'mouse', clientX: 40, clientY: 40 });
    fireEvent.click(anna);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('cancels a drag with Escape', () => {
    renderBuilder();
    const anna = card('Anna Schmidt');
    pointer('pointerdown', anna, { pointerType: 'mouse', button: 0, clientX: 10, clientY: 10 });
    pointer('pointermove', window, { pointerType: 'mouse', clientX: 60, clientY: 60 });
    expect(screen.getByTestId('drag-ghost')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('drag-ghost')).not.toBeInTheDocument();
  });

  it('starts a touch drag only after a long press', () => {
    vi.useFakeTimers();
    mockFetch();
    renderBuilder();
    const anna = card('Anna Schmidt');
    const ben = card('Ben Mueller');

    pointer('pointerdown', anna, { pointerType: 'touch', clientX: 10, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.queryByTestId('drag-ghost')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByTestId('drag-ghost')).toBeInTheDocument();

    underPointer(ben);
    pointer('pointermove', window, { pointerType: 'touch', clientX: 70, clientY: 70 });
    pointer('pointerup', window, { pointerType: 'touch', clientX: 70, clientY: 70 });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('leaves a touch that moves before the long press to the browser as a scroll', () => {
    vi.useFakeTimers();
    renderBuilder();
    const anna = card('Anna Schmidt');
    pointer('pointerdown', anna, { pointerType: 'touch', clientX: 10, clientY: 10 });
    pointer('pointermove', window, { pointerType: 'touch', clientX: 10, clientY: 60 });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.queryByTestId('drag-ghost')).not.toBeInTheDocument();
  });
});
