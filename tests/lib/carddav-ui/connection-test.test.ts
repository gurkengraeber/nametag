import { describe, it, expect } from 'vitest';
import {
  classifyTestFailure,
  reasonFromResponse,
  summarizeAddressBooks,
  normalizeServerUrl,
} from '@/lib/carddav-ui/connection-test';

describe('classifyTestFailure', () => {
  it.each([
    ['Invalid credentials, response 401', 'auth'],
    ['Request failed with 403 Forbidden', 'auth'],
    ['404 not found', 'not_found'],
    ['connect ETIMEDOUT 1.2.3.4:443', 'timeout'],
    ['Cannot find homeUrl', 'discovery'],
    ['boom', 'unknown'],
  ])('%s -> %s', (message, reason) => {
    expect(classifyTestFailure(new Error(message))).toBe(reason);
  });

  it('looks into the cause chain of a fetch failure', () => {
    const cause = Object.assign(new Error('getaddrinfo ENOTFOUND dav.example.invalid'), { code: 'ENOTFOUND' });
    const error = new Error('fetch failed', { cause });
    expect(classifyTestFailure(error)).toBe('dns');
  });

  it('recognises a refused connection and certificate problems', () => {
    expect(classifyTestFailure(new Error('fetch failed', { cause: Object.assign(new Error('x'), { code: 'ECONNREFUSED' }) }))).toBe('refused');
    expect(classifyTestFailure(new Error('fetch failed', { cause: Object.assign(new Error('x'), { code: 'CERT_HAS_EXPIRED' }) }))).toBe('tls');
    expect(classifyTestFailure(new Error('self-signed certificate'))).toBe('tls');
  });

  it('copes with values that are not errors', () => {
    expect(classifyTestFailure('401')).toBe('auth');
    expect(classifyTestFailure(undefined)).toBe('unknown');
  });
});

describe('reasonFromResponse', () => {
  it('reads a known reason', () => {
    expect(reasonFromResponse({ code: 'carddav_unreachable', params: { reason: 'dns' } })).toBe('dns');
  });

  it('falls back to unknown', () => {
    expect(reasonFromResponse({ params: { reason: 'made-up' } })).toBe('unknown');
    expect(reasonFromResponse({})).toBe('unknown');
    expect(reasonFromResponse(null)).toBe('unknown');
  });
});

describe('summarizeAddressBooks', () => {
  it('sums the contact counts', () => {
    expect(
      summarizeAddressBooks([
        { url: 'a', displayName: 'Contacts', contactCount: 120 },
        { url: 'b', displayName: 'Collected', contactCount: 3 },
      ]),
    ).toEqual({ bookCount: 2, contactCount: 123, countUnknown: false });
  });

  it('flags books that did not report a size', () => {
    expect(
      summarizeAddressBooks([
        { url: 'a', displayName: null, contactCount: 5 },
        { url: 'b', displayName: null, contactCount: null },
      ]),
    ).toEqual({ bookCount: 2, contactCount: 5, countUnknown: true });
  });

  it('handles a missing list', () => {
    expect(summarizeAddressBooks(undefined)).toEqual({ bookCount: 0, contactCount: 0, countUnknown: false });
  });
});

describe('normalizeServerUrl', () => {
  it('adds https and trims', () => {
    expect(normalizeServerUrl('  dav.example.com ')).toBe('https://dav.example.com');
    expect(normalizeServerUrl('http://dav.example.com')).toBe('http://dav.example.com');
    expect(normalizeServerUrl('')).toBe('');
  });
});
