import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  addPersonToGroup,
  markContactedToday,
  savePersonAddresses,
  setPersonRelationship,
} from '../../lib/map/quick-actions';

describe('map quick actions', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function lastCall() {
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    return { url, method: init.method, body: JSON.parse(String(init.body)) as unknown };
  }

  it('sets the last contact with a partial update', async () => {
    expect(await markContactedToday('p1', '2026-11-09')).toBe(true);
    expect(lastCall()).toEqual({ url: '/api/people/p1', method: 'PUT', body: { lastContact: '2026-11-09' } });
  });

  it('sets and clears the relationship', async () => {
    await setPersonRelationship('p1', 'rel-1');
    expect(lastCall().body).toEqual({ relationshipToUserId: 'rel-1' });
    fetchMock.mockClear();
    await setPersonRelationship('p1', null);
    expect(lastCall().body).toEqual({ relationshipToUserId: null });
  });

  it('adds to a group through the bulk route with explicit ids and never selectAll', async () => {
    await addPersonToGroup('p1', 'g1');
    const call = lastCall();
    expect(call.url).toBe('/api/people/bulk');
    expect(call.method).toBe('POST');
    expect(call.body).toEqual({ action: 'addToGroups', personIds: ['p1'], groupIds: ['g1'] });
  });

  it('sends the full address list', async () => {
    const addresses = [
      { type: 'home', streetLine1: null, streetLine2: null, locality: 'Oslo', region: null, postalCode: null, country: 'NO' },
    ];
    await savePersonAddresses('p/1', addresses);
    expect(lastCall()).toEqual({ url: '/api/people/p%2F1', method: 'PUT', body: { addresses } });
  });

  it('reports failure for error responses and network errors', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false });
    expect(await markContactedToday('p1')).toBe(false);
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await markContactedToday('p1')).toBe(false);
  });
});
