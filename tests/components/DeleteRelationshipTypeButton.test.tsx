import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import DeleteRelationshipTypeButton from '../../components/DeleteRelationshipTypeButton';
import enMessages from '../../locales/en.json';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh })),
}));

const renderButton = (peopleCount: number, connectionCount: number) =>
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <DeleteRelationshipTypeButton
        relationshipTypeId="t1"
        relationshipTypeName="Friend"
        peopleCount={peopleCount}
        connectionCount={connectionCount}
      />
    </NextIntlClientProvider>
  );

describe('DeleteRelationshipTypeButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) } as Response)
    );
  });

  it('blocks deletion and explains why while connections use the type', async () => {
    const user = userEvent.setup();
    renderButton(2, 3);

    await user.click(screen.getByRole('button', { name: 'Delete Friend' }));

    expect(screen.getByText(/3 connections between people still use this type/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  });

  it('tells how many people are affected and deletes after confirming', async () => {
    const user = userEvent.setup();
    renderButton(2, 0);

    await user.click(screen.getByRole('button', { name: 'Delete Friend' }));
    expect(screen.getByText(/relationship with 2 people/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/relationship-types/t1', { method: 'DELETE' })
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('says so when nobody uses the type', async () => {
    const user = userEvent.setup();
    renderButton(0, 0);

    await user.click(screen.getByRole('button', { name: 'Delete Friend' }));
    expect(screen.getByText('Nobody uses this type right now.')).toBeInTheDocument();
  });
});
