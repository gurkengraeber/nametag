import { describe, it, expect } from 'vitest';
import {
  getPersonFormDefaultsKey,
  loadPersonFormDefaults,
  savePersonFormDefaults,
  sanitizePersonFormDefaults,
  mapServerFieldErrors,
  isAfterToday,
} from '@/lib/person-form-support';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    removeItem: (key: string) => {
      delete data[key];
    },
  };
}

const NOW = Date.UTC(2026, 10, 9);
const DAY = 24 * 60 * 60 * 1000;

describe('person form defaults storage', () => {
  it('uses a key namespaced by account', () => {
    expect(getPersonFormDefaultsKey('u1')).toBe('nametag:newPerson:u1:defaults');
  });

  it('round-trips defaults and stores only ids', () => {
    const storage = memoryStorage();
    savePersonFormDefaults('u1', { relationshipToUserId: 'rt1', groupIds: ['g1', 'g2'] }, storage, NOW);
    expect(Object.keys(storage.data)).toEqual(['nametag:newPerson:u1:defaults']);
    expect(JSON.parse(storage.data['nametag:newPerson:u1:defaults'])).toEqual({
      userId: 'u1',
      savedAt: NOW,
      relationshipToUserId: 'rt1',
      groupIds: ['g1', 'g2'],
    });
    expect(loadPersonFormDefaults('u1', storage, NOW + DAY)).toEqual({
      relationshipToUserId: 'rt1',
      groupIds: ['g1', 'g2'],
    });
  });

  it('does not hand out another account\'s values', () => {
    const storage = memoryStorage();
    savePersonFormDefaults('u1', { relationshipToUserId: 'rt1', groupIds: [] }, storage, NOW);
    expect(loadPersonFormDefaults('u2', storage, NOW)).toBeNull();
    // Even a value copied under the wrong key is rejected by the embedded id
    storage.data[getPersonFormDefaultsKey('u2')] = storage.data[getPersonFormDefaultsKey('u1')];
    expect(loadPersonFormDefaults('u2', storage, NOW)).toBeNull();
  });

  it('discards values older than 30 days', () => {
    const storage = memoryStorage();
    savePersonFormDefaults('u1', { relationshipToUserId: 'rt1', groupIds: [] }, storage, NOW);
    expect(loadPersonFormDefaults('u1', storage, NOW + 29 * DAY)).not.toBeNull();
    expect(loadPersonFormDefaults('u1', storage, NOW + 31 * DAY)).toBeNull();
    expect(storage.data[getPersonFormDefaultsKey('u1')]).toBeUndefined();
  });

  it('returns null for missing, broken or foreign data', () => {
    const key = getPersonFormDefaultsKey('u1');
    expect(loadPersonFormDefaults('u1', null)).toBeNull();
    expect(loadPersonFormDefaults('', memoryStorage())).toBeNull();
    expect(loadPersonFormDefaults('u1', memoryStorage())).toBeNull();
    expect(loadPersonFormDefaults('u1', memoryStorage({ [key]: '{oops' }))).toBeNull();
    expect(loadPersonFormDefaults('u1', memoryStorage({ [key]: '"text"' }))).toBeNull();
  });

  it('ignores wrongly typed members', () => {
    const key = getPersonFormDefaultsKey('u1');
    const storage = memoryStorage({
      [key]: JSON.stringify({ userId: 'u1', savedAt: NOW, relationshipToUserId: 5, groupIds: ['g1', 7, null] }),
    });
    expect(loadPersonFormDefaults('u1', storage, NOW)).toEqual({ relationshipToUserId: '', groupIds: ['g1'] });
  });

  it('does not throw when storage fails', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    };
    expect(loadPersonFormDefaults('u1', broken)).toBeNull();
    expect(() => savePersonFormDefaults('u1', { relationshipToUserId: '', groupIds: [] }, broken)).not.toThrow();
  });
});

describe('sanitizePersonFormDefaults', () => {
  it('drops ids that no longer exist', () => {
    expect(
      sanitizePersonFormDefaults({ relationshipToUserId: 'gone', groupIds: ['g1', 'gone'] }, ['rt1'], ['g1'])
    ).toEqual({ relationshipToUserId: '', groupIds: ['g1'] });
    expect(
      sanitizePersonFormDefaults({ relationshipToUserId: 'rt1', groupIds: [] }, ['rt1'], [])
    ).toEqual({ relationshipToUserId: 'rt1', groupIds: [] });
  });
});

describe('mapServerFieldErrors', () => {
  it('maps issues to top-level fields and keeps the first per field', () => {
    expect(
      mapServerFieldErrors([
        { path: 'name', issue: 'too_long', params: { max: 100 } },
        { path: 'name', issue: 'required' },
        { path: 'emails.0.email', issue: 'invalid_format' },
        { path: 'lastContact', issue: 'invalid_value' },
      ])
    ).toEqual({
      name: { issue: 'too_long', max: 100 },
      emails: { issue: 'invalid_format' },
      lastContact: { issue: 'invalid_value' },
    });
  });

  it('ignores malformed input', () => {
    expect(mapServerFieldErrors(undefined)).toEqual({});
    expect(mapServerFieldErrors([null, 'x', { path: 3 }, { path: 'a', issue: 'weird' }])).toEqual({});
  });
});

describe('isAfterToday', () => {
  it('compares calendar days, so today is not in the future', () => {
    expect(isAfterToday('2026-03-02', '2026-03-02')).toBe(false);
    expect(isAfterToday('2026-03-01', '2026-03-02')).toBe(false);
    expect(isAfterToday('2026-03-03', '2026-03-02')).toBe(true);
  });
});
