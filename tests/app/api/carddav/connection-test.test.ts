/**
 * Tests for POST /api/carddav/connection/test: the reason hint on failures and
 * testing with the saved password while editing a connection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auth } from '@/lib/auth';

const mocks = vi.hoisted(() => ({
  findConnection: vi.fn(),
  decryptPassword: vi.fn(),
  validateServerUrl: vi.fn(),
  createDAVClient: vi.fn(),
}));

vi.mock('@/lib/auth');
vi.mock('@/lib/prisma', () => ({
  prisma: { cardDavConnection: { findUnique: mocks.findConnection } },
}));
vi.mock('@/lib/carddav/encryption', () => ({ decryptPassword: mocks.decryptPassword }));
vi.mock('@/lib/carddav/url-validation', () => ({ validateServerUrl: mocks.validateServerUrl }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: () => null }));
vi.mock('tsdav', () => ({ createDAVClient: mocks.createDAVClient }));
vi.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

import { POST } from '@/app/api/carddav/connection/test/route';

function post(body: Record<string, unknown>) {
  return POST(
    new Request('http://localhost/api/carddav/connection/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

function fakeClient(contacts: number) {
  return {
    fetchAddressBooks: vi.fn().mockResolvedValue([{ url: '/books/default/', displayName: 'Contacts' }]),
    propfind: vi.fn().mockResolvedValue([{ props: {} }, ...Array.from({ length: contacts }, () => ({ props: {} }))]),
  };
}

describe('POST /api/carddav/connection/test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'user-1', email: 'u@example.com' } });
    mocks.validateServerUrl.mockResolvedValue(undefined);
  });

  it('returns the address books with their contact counts', async () => {
    mocks.createDAVClient.mockResolvedValue(fakeClient(3));
    const res = await post({ serverUrl: 'https://dav.example.com/', username: 'ada', password: 'pw' });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.addressBooks).toEqual([
      { url: 'https://dav.example.com/books/default/', displayName: 'Contacts', description: null, contactCount: 3 },
    ]);
  });

  it.each([
    ['Invalid credentials, response 401', 400, 'carddav_auth_failed', 'auth'],
    ['404 not found', 502, 'carddav_unreachable', 'not_found'],
    ['connect ETIMEDOUT', 502, 'carddav_unreachable', 'timeout'],
    ['getaddrinfo ENOTFOUND dav.example.invalid', 502, 'carddav_unreachable', 'dns'],
    ['self-signed certificate', 502, 'carddav_unreachable', 'tls'],
    ['boom', 502, 'carddav_unreachable', 'unknown'],
  ])('%s gives reason hint', async (message, status, code, reason) => {
    mocks.createDAVClient.mockRejectedValue(new Error(message));
    const res = await post({ serverUrl: 'https://dav.example.com', username: 'ada', password: 'pw' });
    const data = await res.json();
    expect(res.status).toBe(status);
    expect(data.code).toBe(code);
    expect(data.params).toEqual({ reason });
  });

  it('gives up on a server that never answers', async () => {
    vi.useFakeTimers();
    try {
      mocks.createDAVClient.mockReturnValue(new Promise(() => {}));
      const pending = post({ serverUrl: 'https://dav.example.com', username: 'ada', password: 'pw' });
      await vi.advanceTimersByTimeAsync(31_000);
      const res = await pending;
      const data = await res.json();
      expect(res.status).toBe(502);
      expect(data.params).toEqual({ reason: 'timeout' });
    } finally {
      vi.useRealTimers();
    }
  });

  describe('without a password', () => {
    it('uses the saved password for the saved server', async () => {
      mocks.findConnection.mockResolvedValue({ serverUrl: 'https://dav.example.com/', password: 'enc' });
      mocks.decryptPassword.mockReturnValue('saved-secret');
      mocks.createDAVClient.mockResolvedValue(fakeClient(1));

      const res = await post({ serverUrl: 'https://DAV.example.com', username: 'ada' });
      expect(res.status).toBe(200);
      expect(mocks.createDAVClient.mock.calls[0][0].credentials).toEqual({ username: 'ada', password: 'saved-secret' });
    });

    it('never sends the saved password to a different server', async () => {
      mocks.findConnection.mockResolvedValue({ serverUrl: 'https://dav.example.com/', password: 'enc' });
      mocks.decryptPassword.mockReturnValue('saved-secret');

      const res = await post({ serverUrl: 'https://other.example.net', username: 'ada' });
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.code).toBe('password_required');
      expect(mocks.createDAVClient).not.toHaveBeenCalled();
      expect(mocks.decryptPassword).not.toHaveBeenCalled();
    });

    it('asks for a password when nothing is saved', async () => {
      mocks.findConnection.mockResolvedValue(null);
      const res = await post({ serverUrl: 'https://dav.example.com', username: 'ada' });
      expect((await res.json()).code).toBe('password_required');
    });
  });
});
