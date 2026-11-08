import { describe, it, expect } from 'vitest';
import {
  PERSON_FORM_DEFAULTS_KEY,
  loadPersonFormDefaults,
  savePersonFormDefaults,
  sanitizePersonFormDefaults,
  mapServerFieldErrors,
} from '@/lib/person-form-support';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

describe('person form defaults storage', () => {
  it('round-trips defaults', () => {
    const storage = memoryStorage();
    savePersonFormDefaults({ relationshipToUserId: 'rt1', groupIds: ['g1', 'g2'] }, storage);
    expect(loadPersonFormDefaults(storage)).toEqual({ relationshipToUserId: 'rt1', groupIds: ['g1', 'g2'] });
  });

  it('returns null for missing, broken or foreign data', () => {
    expect(loadPersonFormDefaults(null)).toBeNull();
    expect(loadPersonFormDefaults(memoryStorage())).toBeNull();
    expect(loadPersonFormDefaults(memoryStorage({ [PERSON_FORM_DEFAULTS_KEY]: '{oops' }))).toBeNull();
    expect(loadPersonFormDefaults(memoryStorage({ [PERSON_FORM_DEFAULTS_KEY]: '"text"' }))).toBeNull();
  });

  it('ignores wrongly typed members', () => {
    const storage = memoryStorage({
      [PERSON_FORM_DEFAULTS_KEY]: JSON.stringify({ relationshipToUserId: 5, groupIds: ['g1', 7, null] }),
    });
    expect(loadPersonFormDefaults(storage)).toEqual({ relationshipToUserId: '', groupIds: ['g1'] });
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
    expect(loadPersonFormDefaults(broken)).toBeNull();
    expect(() => savePersonFormDefaults({ relationshipToUserId: '', groupIds: [] }, broken)).not.toThrow();
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
