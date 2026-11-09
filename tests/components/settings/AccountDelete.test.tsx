import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '@/locales/en.json';
import AccountManagement from '@/components/AccountManagement';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('next-auth/react', () => ({ signOut: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('AccountManagement delete section', () => {
  it('recommends exporting first and says what will be removed', async () => {
    const user = userEvent.setup();
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <AccountManagement groups={[{ id: 'g1', name: 'Family', color: null }]} peopleCount={3} />
      </NextIntlClientProvider>
    );
    expect(screen.getByText(/download a copy under Export data first/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete Account' }));
    expect(
      screen.getByText('This deletes your account together with 3 people and 1 group.')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Type DELETE to confirm')).toHaveAttribute('autocomplete', 'off');
  });
});
