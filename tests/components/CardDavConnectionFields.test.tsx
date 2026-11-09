import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import ConnectionFields, { type ConnectionFieldValues } from '@/components/carddav/ConnectionFields';
import { useConnectionTest } from '@/components/carddav/useConnectionTest';
import { CARDDAV_PROVIDERS } from '@/lib/carddav/types';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));

function Harness({ initial }: { initial?: Partial<ConnectionFieldValues> }) {
  const [values, setValues] = useState<ConnectionFieldValues>({
    provider: 'mailbox',
    serverUrl: CARDDAV_PROVIDERS.mailbox.serverUrl,
    username: 'ada@example.com',
    password: 'secret',
    ...initial,
  });
  const { state, run, reset } = useConnectionTest();
  return (
    <ConnectionFields
      values={values}
      onProviderChange={(provider) => {
        setValues((v) => ({ ...v, provider, serverUrl: CARDDAV_PROVIDERS[provider]?.serverUrl ?? '' }));
        reset();
      }}
      onFieldChange={(field, value) => {
        setValues((v) => ({ ...v, [field]: value }));
        reset();
      }}
      testState={state}
      onTest={() => run({ serverUrl: values.serverUrl, username: values.username, password: values.password })}
      canTest
    />
  );
}

function respond(status: number, body: unknown) {
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response)
  ) as unknown as typeof fetch;
}

describe('CardDAV connection fields', () => {
  beforeEach(() => vi.clearAllMocks());

  it('offers a mailbox.org preset with its server address', () => {
    render(<Harness />);
    expect(screen.getByRole('option', { name: 'mailbox.org' })).toBeDefined();
    expect((screen.getByLabelText('serverUrlLabel') as HTMLInputElement).value).toBe('https://dav.mailbox.org/');
    expect((screen.getByLabelText('serverUrlLabel') as HTMLInputElement).disabled).toBe(true);
  });

  it('keeps the address editable for Nextcloud and custom servers', () => {
    const { unmount } = render(<Harness initial={{ provider: 'nextcloud', serverUrl: '' }} />);
    expect((screen.getByLabelText('serverUrlLabel') as HTMLInputElement).disabled).toBe(false);
    unmount();
    render(<Harness initial={{ provider: 'custom', serverUrl: '' }} />);
    expect((screen.getByLabelText('serverUrlLabel') as HTMLInputElement).disabled).toBe(false);
  });

  it('shows and hides the password', () => {
    render(<Harness />);
    const input = screen.getByLabelText('passwordLabel') as HTMLInputElement;
    expect(input.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'showPassword' }));
    expect(input.type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'hidePassword' }));
    expect(input.type).toBe('password');
  });

  it('mentions the app password for mailbox.org', () => {
    render(<Harness />);
    expect(screen.getByText(/appPasswordWithTwoFactor/)).toBeDefined();
  });

  it('reports how many contacts were found', async () => {
    respond(200, {
      addressBooks: [
        { url: 'a', displayName: 'Contacts', description: null, contactCount: 120 },
        { url: 'b', displayName: 'Collected', description: null, contactCount: 3 },
      ],
    });
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'testConnection' }));
    await waitFor(() => screen.getByText(/testSuccessCount/));
    expect(screen.getByText(/testSuccessCount/).textContent).toContain('"count":123');
    expect(screen.getByText(/testSuccessCount/).textContent).toContain('"books":2');
    expect(screen.getByText(/Collected/)).toBeDefined();
  });

  it('warns when the server reports no contacts', async () => {
    respond(200, { addressBooks: [{ url: 'a', displayName: 'Contacts', description: null, contactCount: 0 }] });
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'testConnection' }));
    await waitFor(() => screen.getByText('testZeroContacts'));
  });

  it('explains a rejected login', async () => {
    respond(400, { code: 'carddav_auth_failed', error: 'Authentication failed.', params: { reason: 'auth' } });
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'testConnection' }));
    await waitFor(() => screen.getByText('testReason_auth'));
    expect(screen.getByText('testFailedTitle')).toBeDefined();
  });

  it('explains an unreachable network', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'testConnection' }));
    await waitFor(() => screen.getByText('testReason_network'));
  });

  it('sends the normalized address and leaves the password out when empty', async () => {
    respond(200, { addressBooks: [] });
    render(<Harness initial={{ provider: 'custom', serverUrl: 'dav.example.com', password: '' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'testConnection' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const body = JSON.parse(((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ serverUrl: 'https://dav.example.com', username: 'ada@example.com' });
  });

  it('clears the result when a field changes', async () => {
    respond(200, { addressBooks: [{ url: 'a', displayName: 'Contacts', description: null, contactCount: 2 }] });
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'testConnection' }));
    await waitFor(() => screen.getByText(/testSuccessCount/));
    fireEvent.change(screen.getByLabelText('usernameLabel'), { target: { value: 'grace@example.com' } });
    expect(screen.queryByText(/testSuccessCount/)).toBeNull();
  });
});
