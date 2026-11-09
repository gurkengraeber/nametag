import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import RelationshipTypeForm from '../../components/RelationshipTypeForm';
import enMessages from '../../locales/en.json';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
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

const types = [
  { id: 't1', name: 'FRIEND', label: 'Friend', color: '#EF4444', inverseId: 't1' },
  { id: 't2', name: 'MENTOR', label: 'Mentor', color: '#F97316', inverseId: null },
];

describe('RelationshipTypeForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response)
    );
  });

  it('starts symmetric in create mode and explains it with an example', async () => {
    const user = userEvent.setup();
    render(<Wrapper><RelationshipTypeForm availableTypes={types} mode="create" /></Wrapper>);

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    await user.type(screen.getByLabelText(/relationship label/i), 'Neighbor');
    expect(screen.getByText("Example: if Alex is your Neighbor, you are Alex's Neighbor too.")).toBeInTheDocument();
  });

  it('shows the inverse in the example when the type is not symmetric', async () => {
    const user = userEvent.setup();
    render(<Wrapper><RelationshipTypeForm availableTypes={types} mode="create" /></Wrapper>);

    await user.click(screen.getByRole('switch'));
    await user.type(screen.getByLabelText(/relationship label/i), 'Student');
    await user.type(screen.getByPlaceholderText(/search existing/i), 'Mentor');
    await user.click(await screen.findByText('Mentor'));

    expect(screen.getByText("Example: if Alex is your Student, you are Alex's Mentor.")).toBeInTheDocument();
  });

  it('warns about a very similar existing type', async () => {
    const user = userEvent.setup();
    render(<Wrapper><RelationshipTypeForm availableTypes={types} mode="create" /></Wrapper>);

    await user.type(screen.getByLabelText(/relationship label/i), 'Friends');
    expect(screen.getByRole('status')).toHaveTextContent('Looks similar to the existing type "Friend"');
  });

  it('sends symmetric: true when creating a symmetric type', async () => {
    const user = userEvent.setup();
    render(<Wrapper><RelationshipTypeForm availableTypes={types} mode="create" /></Wrapper>);

    await user.type(screen.getByLabelText(/relationship label/i), 'Neighbor{Enter}');

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/relationship-types');
    expect(JSON.parse(init.body)).toMatchObject({ label: 'Neighbor', name: 'NEIGHBOR', symmetric: true });
  });
});
