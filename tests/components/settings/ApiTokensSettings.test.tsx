import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '@/locales/en.json';
import ApiTokensSettings from '@/components/ApiTokensSettings';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const existing = {
  id: 't1',
  name: 'Backup script',
  prefix: 'nt_abcd',
  scope: 'READ',
  lastUsedAt: null,
  expiresAt: null,
  createdAt: '2026-01-01T10:00:00.000Z',
};

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(handler(String(input), init))
  ) as typeof fetch;
}

function renderTokens() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ApiTokensSettings />
    </NextIntlClientProvider>
  );
}

describe('ApiTokensSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('explains what each access level can do', async () => {
    mockFetch(() => new Response(JSON.stringify({ tokens: [] })));
    const user = userEvent.setup();
    renderTokens();
    expect(await screen.findByText(/Can look at and change your people/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Access'), 'READ');
    expect(screen.getByText(/but not change anything/)).toBeInTheDocument();
  });

  it('puts the missing name on the name field', async () => {
    mockFetch(() => new Response(JSON.stringify({ tokens: [] })));
    const user = userEvent.setup();
    renderTokens();
    await user.click(await screen.findByRole('button', { name: 'Create token' }));
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Please enter a name for the token.')).toBeInTheDocument();
  });

  it('sends the expiry of the chosen preset and shows the new token once', async () => {
    let body: { expiresAt: string | null } | null = null;
    mockFetch((url, init) => {
      if (init?.method === 'POST') {
        body = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ apiToken: { ...existing, token: 'nt_secret_value' } }));
      }
      return new Response(JSON.stringify({ tokens: [] }));
    });
    const user = userEvent.setup();
    renderTokens();
    await user.type(await screen.findByLabelText('Name'), 'My tool');
    await user.selectOptions(screen.getByLabelText('Expires (optional)'), 'days30');
    await user.click(screen.getByRole('button', { name: 'Create token' }));
    expect(await screen.findByTestId('new-token')).toHaveTextContent('nt_secret_value');
    expect(body).not.toBeNull();
    expect(body!.expiresAt).not.toBeNull();
  });

  it('does not create a token whose chosen expiry day is already over', async () => {
    const methods: string[] = [];
    mockFetch((_url, init) => {
      methods.push(init?.method ?? 'GET');
      return new Response(JSON.stringify({ tokens: [] }));
    });
    const user = userEvent.setup();
    renderTokens();
    await user.type(await screen.findByLabelText('Name'), 'My tool');
    await user.selectOptions(screen.getByLabelText('Expires (optional)'), 'custom');
    fireEvent.change(screen.getByLabelText('Pick a date'), { target: { value: '2000-01-01' } });
    await user.click(screen.getByRole('button', { name: 'Create token' }));

    expect(methods).not.toContain('POST');
  });

  it('asks in a dialog before revoking and only then deletes', async () => {
    const calls: string[] = [];
    mockFetch((url, init) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      return new Response(JSON.stringify({ tokens: [existing] }));
    });
    const user = userEvent.setup();
    renderTokens();
    await user.click(await screen.findByRole('button', { name: 'Revoke: Backup script' }));
    expect(calls.some((call) => call.startsWith('DELETE'))).toBe(false);

    const heading = await screen.findByRole('heading', { name: 'Revoke "Backup script"?' });
    const modal = heading.parentElement as HTMLElement;
    await user.click(within(modal).getByRole('button', { name: 'Revoke' }));
    await waitFor(() => expect(calls).toContain('DELETE /api/user/api-tokens/t1'));
  });
});
