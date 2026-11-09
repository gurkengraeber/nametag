import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '@/locales/en.json';
import PasswordChangeForm from '@/components/PasswordChangeForm';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { email: 'a@example.com' } } }),
  signIn: vi.fn().mockResolvedValue({ error: null }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <PasswordChangeForm userId="u1" />
    </NextIntlClientProvider>
  );
}

describe('PasswordChangeForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('keeps the save button disabled until something is typed', async () => {
    const user = userEvent.setup();
    renderForm();
    const save = screen.getByRole('button', { name: 'Change Password' });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText('Current Password'), 'x');
    expect(save).toBeEnabled();
    expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
  });

  it('puts a mismatch error on the confirmation field without calling the server', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Current Password'), 'Old-pass1!');
    await user.type(screen.getByLabelText('New Password'), 'New-pass1!');
    await user.type(screen.getByLabelText('Confirm New Password'), 'Other-pass1!');
    await user.click(screen.getByRole('button', { name: 'Change Password' }));
    const field = screen.getByLabelText('Confirm New Password');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows a wrong current password on that field', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Current password is incorrect', code: 'wrong_password' }), { status: 400 })
    );
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Current Password'), 'Old-pass1!');
    await user.type(screen.getByLabelText('New Password'), 'New-pass1!');
    await user.type(screen.getByLabelText('Confirm New Password'), 'New-pass1!');
    await user.click(screen.getByRole('button', { name: 'Change Password' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Current Password')).toHaveAttribute('aria-invalid', 'true')
    );
    expect(screen.getByText('Current password is incorrect')).toBeInTheDocument();
  });

  it('reveals the passwords on request', async () => {
    const user = userEvent.setup();
    renderForm();
    expect(screen.getByLabelText('New Password')).toHaveAttribute('type', 'password');
    await user.click(screen.getByLabelText('Show passwords'));
    expect(screen.getByLabelText('New Password')).toHaveAttribute('type', 'text');
  });
});
