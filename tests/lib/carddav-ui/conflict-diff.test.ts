import { describe, it, expect } from 'vitest';
import {
  compareVersions,
  recommendResolution,
  parseVersion,
  planBulkResolution,
  type ConflictPersonData,
} from '@/lib/carddav-ui/conflict-diff';

const base: ConflictPersonData = {
  name: 'Ada',
  surname: 'Example',
  organization: 'Engines Ltd',
  phoneNumbers: [{ type: 'CELL', number: '+49 30 1234' }],
  emails: [{ type: 'HOME', email: 'ada@example.com' }],
};

describe('parseVersion', () => {
  it('parses JSON and survives garbage', () => {
    expect(parseVersion('{"name":"Ada"}')).toEqual({ name: 'Ada' });
    expect(parseVersion('not json')).toEqual({});
    expect(parseVersion('"text"')).toEqual({});
  });
});

describe('compareVersions', () => {
  it('reports no differences for identical data', () => {
    const result = compareVersions(base, { ...base });
    expect(result.different).toEqual([]);
    expect(result.sameKeys).toContain('name');
    expect(result.sameKeys).toContain('phones');
  });

  it('marks a changed scalar field', () => {
    const result = compareVersions(base, { ...base, organization: 'Analytical Engines' });
    expect(result.different).toHaveLength(1);
    expect(result.different[0]).toMatchObject({
      key: 'organization',
      status: 'changed',
      local: ['Engines Ltd'],
      remote: ['Analytical Engines'],
    });
  });

  it('marks fields that exist on one side only', () => {
    const result = compareVersions(base, { ...base, jobTitle: 'Programmer' });
    expect(result.different[0]).toMatchObject({ key: 'jobTitle', status: 'remoteOnly', local: [] });
    const reverse = compareVersions({ ...base, jobTitle: 'Programmer' }, base);
    expect(reverse.different[0]).toMatchObject({ key: 'jobTitle', status: 'localOnly', remote: [] });
  });

  it('ignores whitespace and line ending noise', () => {
    const result = compareVersions({ ...base, notes: 'a\r\nb ' }, { ...base, notes: 'a\nb' });
    expect(result.different).toEqual([]);
  });

  it('treats a date with and without time as the same day', () => {
    const result = compareVersions({ birthday: '1990-02-03T00:00:00.000Z' }, { birthday: '1990-02-03' });
    expect(result.different).toEqual([]);
  });

  it('ignores the order of list values', () => {
    const local = { phoneNumbers: [{ type: 'CELL', number: '1' }, { type: 'WORK', number: '2' }] };
    const remote = { phoneNumbers: [{ type: 'WORK', number: '2' }, { type: 'CELL', number: '1' }] };
    expect(compareVersions(local, remote).different).toEqual([]);
  });

  it('finds the single entries that differ in a list', () => {
    const local = { phoneNumbers: [{ type: 'CELL', number: '1' }] };
    const remote = { phoneNumbers: [{ type: 'CELL', number: '1' }, { type: 'WORK', number: '2' }] };
    const [diff] = compareVersions(local, remote).different;
    expect(diff.key).toBe('phones');
    expect(diff.onlyRemote).toEqual(['2 (WORK)']);
    expect(diff.onlyLocal).toEqual([]);
    expect(diff.status).toBe('changed');
  });

  it('skips fields that are empty on both sides', () => {
    const result = compareVersions({ name: 'Ada' }, { name: 'Ada' });
    expect(result.sameKeys).toEqual(['name']);
  });
});

describe('recommendResolution', () => {
  it('recommends either side when nothing differs', () => {
    const rec = recommendResolution(compareVersions(base, base));
    expect(rec).toEqual({ choice: 'keep_local', reason: 'identical', safe: true });
  });

  it('recommends the server when it only adds details', () => {
    const rec = recommendResolution(
      compareVersions(base, { ...base, jobTitle: 'Programmer', emails: [...base.emails!, { type: 'WORK', email: 'a@work.example' }] }),
    );
    expect(rec).toEqual({ choice: 'keep_remote', reason: 'serverAdds', safe: true });
  });

  it('recommends Nametag when Nametag only adds details', () => {
    const rec = recommendResolution(compareVersions({ ...base, jobTitle: 'Programmer' }, base));
    expect(rec).toEqual({ choice: 'keep_local', reason: 'localAdds', safe: true });
  });

  it('gives no recommendation when both sides changed the same field', () => {
    const rec = recommendResolution(compareVersions(base, { ...base, organization: 'Other' }));
    expect(rec).toEqual({ choice: null, reason: 'differs', safe: false });
  });

  it('gives no recommendation when each side added something different', () => {
    const rec = recommendResolution(
      compareVersions({ ...base, jobTitle: 'Programmer' }, { ...base, nickname: 'Countess' }),
    );
    expect(rec.choice).toBeNull();
  });
});

describe('data that cannot be compared', () => {
  it('flags a photo, groups or dates on either side', () => {
    expect(compareVersions(base, base).unverified).toBe(false);
    expect(compareVersions(base, { ...base, photo: 'data:image/png;base64,AAAA' }).unverified).toBe(true);
    expect(compareVersions({ ...base, photo: 'a.jpg' }, base).unverified).toBe(true);
    expect(compareVersions(base, { ...base, categories: ['Family'] }).unverified).toBe(true);
    expect(compareVersions(base, { ...base, importantDates: [{ type: 'birthday' }] }).unverified).toBe(true);
    expect(compareVersions(base, { ...base, categories: [], importantDates: [] }).unverified).toBe(false);
  });

  it('does not call equal-looking versions identical when a birthday could differ', () => {
    const remote = { ...base, importantDates: [{ type: 'birthday' }] };
    expect(recommendResolution(compareVersions(base, remote))).toEqual({
      choice: null,
      reason: 'unverified',
      safe: false,
    });
  });

  it('does not promise that keeping the server loses nothing when a photo is involved', () => {
    const remote = { ...base, jobTitle: 'Programmer', photo: 'data:image/png;base64,AAAA' };
    expect(recommendResolution(compareVersions(base, remote)).safe).toBe(false);
  });

  it('keeps reporting a real clash as a clash', () => {
    const remote = { ...base, organization: 'Other', categories: ['Family'] };
    expect(recommendResolution(compareVersions(base, remote)).reason).toBe('differs');
  });

  it('leaves such conflicts out of the safe bulk plan', () => {
    const conflicts = [
      { id: 'photo', localVersion: JSON.stringify(base), remoteVersion: JSON.stringify({ ...base, photo: 'data:x' }) },
      { id: 'plain', localVersion: JSON.stringify(base), remoteVersion: JSON.stringify(base) },
    ];
    expect(planBulkResolution(conflicts, 'safe')).toEqual([{ id: 'plain', resolution: 'keep_local' }]);
  });
});

describe('planBulkResolution', () => {
  const conflicts = [
    { id: 'same', localVersion: JSON.stringify(base), remoteVersion: JSON.stringify(base) },
    { id: 'adds', localVersion: JSON.stringify(base), remoteVersion: JSON.stringify({ ...base, jobTitle: 'Programmer' }) },
    { id: 'clash', localVersion: JSON.stringify(base), remoteVersion: JSON.stringify({ ...base, organization: 'Other' }) },
  ];

  it('safe mode skips real conflicts', () => {
    expect(planBulkResolution(conflicts, 'safe')).toEqual([
      { id: 'same', resolution: 'keep_local' },
      { id: 'adds', resolution: 'keep_remote' },
    ]);
  });

  it('keep all modes include every conflict', () => {
    expect(planBulkResolution(conflicts, 'keep_remote').map((p) => p.resolution)).toEqual(['keep_remote', 'keep_remote', 'keep_remote']);
    expect(planBulkResolution(conflicts, 'keep_local')).toHaveLength(3);
  });
});
