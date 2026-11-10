import { describe, it, expect } from 'vitest';
import {
  buildDefaultOverrides,
  compareScalarFields,
  compareRelationshipToUser,
  countNonEmptyFields,
  formatFieldValue,
  getScalarValue,
  isSecondarySelected,
  pickInitialPrimaryId,
  summarizeMerge,
  type PersonForCompare,
} from '@/lib/merge-compare';

function makePerson(overrides: Partial<PersonForCompare> = {}): PersonForCompare {
  return {
    id: 'a',
    name: 'Alice',
    surname: null,
    middleName: null,
    secondLastName: null,
    nickname: null,
    prefix: null,
    suffix: null,
    organization: null,
    jobTitle: null,
    gender: null,
    anniversary: null,
    lastContact: null,
    photo: null,
    notes: null,
    relationshipToUserId: null,
    relationshipToUser: null,
    phoneNumbers: [],
    emails: [],
    addresses: [],
    urls: [],
    imHandles: [],
    locations: [],
    customFields: [],
    customFieldValues: [],
    importantDates: [],
    groups: [],
    relationshipsFrom: [],
    relationshipsTo: [],
    ...overrides,
  };
}

describe('getScalarValue', () => {
  it('treats blank strings as empty and formats dates as calendar days', () => {
    expect(getScalarValue(makePerson({ notes: '   ' }), 'notes')).toBeNull();
    expect(
      getScalarValue(makePerson({ lastContact: new Date('2024-03-05T00:00:00.000Z') }), 'lastContact')
    ).toBe('2024-03-05');
  });
});

describe('dates from the API', () => {
  it('cuts timestamps to the day, which is all the merge request accepts', () => {
    const person = makePerson({ anniversary: '2020-06-01T00:00:00.000Z', lastContact: '2024-03-05T14:30:00.000Z' });
    expect(getScalarValue(person, 'anniversary')).toBe('2020-06-01');
    expect(getScalarValue(person, 'lastContact')).toBe('2024-03-05');
  });

  it('does not report two timestamps of the same day as a conflict', () => {
    const a = makePerson({ id: 'a', lastContact: '2024-03-05T00:00:00.000Z' });
    const b = makePerson({ id: 'b', lastContact: '2024-03-05T09:15:00.000Z' });
    expect(compareScalarFields(a, b).find((f) => f.key === 'lastContact')?.status).toBe('same');
  });

  it('sends the chosen date to the merge as a plain day', () => {
    const primary = makePerson({ id: 'a', anniversary: '2020-06-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' });
    const secondary = makePerson({ id: 'b', anniversary: '2021-07-02T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' });
    expect(buildDefaultOverrides(primary, secondary)).toEqual({ anniversary: '2021-07-02' });
  });

  it('shows the stored day west of UTC instead of the day before', () => {
    const previous = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    try {
      expect(formatFieldValue('2024-03-05', 'lastContact')).toBe(new Date(2024, 2, 5).toLocaleDateString());
      expect(formatFieldValue('2024-03-05', 'lastContact')).toContain('5');
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
});

describe('compareScalarFields', () => {
  it('classifies conflicts, equal values, one-sided values and empty fields', () => {
    const a = makePerson({ id: 'a', surname: 'Smith', organization: 'Acme', jobTitle: 'Dev' });
    const b = makePerson({ id: 'b', surname: 'Jones', organization: 'Acme', gender: 'f' });
    const byKey = Object.fromEntries(compareScalarFields(a, b).map((f) => [f.key, f.status]));
    expect(byKey.surname).toBe('conflict');
    expect(byKey.organization).toBe('same');
    expect(byKey.jobTitle).toBe('oneSide');
    expect(byKey.gender).toBe('oneSide');
    expect(byKey.nickname).toBe('empty');
  });
});

describe('compareRelationshipToUser', () => {
  it('reports a conflict only when both have different relationships', () => {
    const a = makePerson({ relationshipToUserId: 'r1', relationshipToUser: { id: 'r1', name: 'Friend' } });
    const b = makePerson({ relationshipToUserId: 'r2', relationshipToUser: { id: 'r2', name: 'Colleague' } });
    expect(compareRelationshipToUser(a, b).status).toBe('conflict');
    expect(compareRelationshipToUser(a, makePerson()).status).toBe('oneSide');
    expect(compareRelationshipToUser(makePerson(), makePerson()).status).toBe('empty');
  });
});

describe('pickInitialPrimaryId', () => {
  it('keeps the contact with more data', () => {
    const a = makePerson({ id: 'a' });
    const b = makePerson({ id: 'b', organization: 'Acme' });
    expect(countNonEmptyFields(b)).toBeGreaterThan(countNonEmptyFields(a));
    expect(pickInitialPrimaryId(a, b)).toBe('b');
  });

  it('breaks ties by the more recent edit, then by order', () => {
    const older = makePerson({ id: 'a', updatedAt: '2024-01-01T00:00:00.000Z' });
    const newer = makePerson({ id: 'b', updatedAt: '2025-01-01T00:00:00.000Z' });
    expect(pickInitialPrimaryId(older, newer)).toBe('b');
    expect(pickInitialPrimaryId(makePerson({ id: 'a' }), makePerson({ id: 'b' }))).toBe('a');
  });
});

describe('buildDefaultOverrides', () => {
  it('takes the newer contact value for conflicts only', () => {
    const primary = makePerson({
      id: 'a', surname: 'Smith', organization: 'Acme', updatedAt: '2024-01-01T00:00:00.000Z',
    });
    const secondary = makePerson({
      id: 'b', surname: 'Jones', jobTitle: 'Dev', updatedAt: '2025-01-01T00:00:00.000Z',
    });
    expect(buildDefaultOverrides(primary, secondary)).toEqual({ surname: 'Jones' });
  });

  it('keeps the primary values when the primary was edited last or timestamps are missing', () => {
    const primary = makePerson({ id: 'a', surname: 'Smith', updatedAt: '2025-01-01T00:00:00.000Z' });
    const secondary = makePerson({ id: 'b', surname: 'Jones', updatedAt: '2024-01-01T00:00:00.000Z' });
    expect(buildDefaultOverrides(primary, secondary)).toEqual({});
    expect(
      buildDefaultOverrides(makePerson({ surname: 'Smith' }), makePerson({ id: 'b', surname: 'Jones' }))
    ).toEqual({});
  });

  it('always prefers the later last-contact date', () => {
    const primary = makePerson({
      id: 'a', lastContact: '2024-05-01', updatedAt: '2025-01-01T00:00:00.000Z',
    });
    const secondary = makePerson({
      id: 'b', lastContact: '2024-09-01', updatedAt: '2024-01-01T00:00:00.000Z',
    });
    expect(buildDefaultOverrides(primary, secondary)).toEqual({ lastContact: '2024-09-01' });
  });

  it('carries the relationship to the user when the newer contact differs', () => {
    const primary = makePerson({
      id: 'a', relationshipToUserId: 'r1', relationshipToUser: { id: 'r1', name: 'Friend' },
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
    const secondary = makePerson({
      id: 'b', relationshipToUserId: 'r2', relationshipToUser: { id: 'r2', name: 'Colleague' },
      updatedAt: '2025-01-01T00:00:00.000Z',
    });
    expect(buildDefaultOverrides(primary, secondary)).toEqual({ relationshipToUserId: 'r2' });
  });
});

describe('isSecondarySelected', () => {
  it('maps the relationship pseudo field to its override key', () => {
    expect(isSecondarySelected('relationshipToUser', { relationshipToUserId: 'r2' })).toBe(true);
    expect(isSecondarySelected('relationshipToUser', {})).toBe(false);
    expect(isSecondarySelected('surname', { surname: 'Jones' })).toBe(true);
  });
});

describe('summarizeMerge', () => {
  it('counts only entries the server would actually transfer', () => {
    const primary = makePerson({
      id: 'a',
      phoneNumbers: [{ type: 'mobile', number: '111' }],
      emails: [{ type: 'home', email: 'Alice@Example.com' }],
      groups: [{ group: { id: 'g1', name: 'Family' } }],
    });
    const secondary = makePerson({
      id: 'b',
      phoneNumbers: [{ type: 'mobile', number: '111' }, { type: 'work', number: '222' }],
      emails: [{ type: 'home', email: 'alice@example.com' }],
      groups: [
        { group: { id: 'g1', name: 'Family' } },
        { group: { id: 'g2', name: 'Friends' } },
      ],
      relationshipsFrom: [{ id: 'r1' }],
      relationshipsTo: [{ id: 'r2' }],
      organization: 'Acme',
    });

    const summary = summarizeMerge(primary, secondary, { surname: 'Jones' });
    const phones = summary.multiValue.find((f) => f.fieldKey === 'phoneNumbers');
    const emails = summary.multiValue.find((f) => f.fieldKey === 'emails');
    expect(phones).toMatchObject({ total: 2, added: 1 });
    expect(emails).toMatchObject({ total: 1, added: 0 });
    expect(summary.groups).toEqual({ total: 2, added: 1 });
    expect(summary.secondaryRelationships).toBe(2);
    expect(summary.adoptedFields).toBe(1);
    expect(summary.secondaryValuesChosen).toBe(1);
  });
});
