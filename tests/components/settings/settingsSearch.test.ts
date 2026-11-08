import { describe, it, expect } from 'vitest';
import { allSettingsItems } from '@/components/settings/settingsCatalog';
import {
  groupSettings,
  isSettingsOverviewPath,
  matchesSetting,
  normalizeSearchText,
  type SearchableSetting,
} from '@/components/settings/settingsSearch';

function entry(id: string, label: string, description: string, keywords: string): SearchableSetting {
  const item = allSettingsItems.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`unknown item ${id}`);
  return { item, label, description, keywords };
}

const entries = [
  entry('profile', 'Profile', 'Name, email, and personal info', 'photo avatar'),
  entry('security', 'Security', 'Password and devices', 'sign out sessions'),
  entry('notifications', 'Notifications', 'Reminders and email', 'push digest'),
  entry('trash', 'Trash', 'Restore deleted items', 'bin'),
];

describe('normalizeSearchText', () => {
  it('lower-cases and strips accents', () => {
    expect(normalizeSearchText('  Übersicht ')).toBe('ubersicht');
  });
});

describe('matchesSetting', () => {
  it('matches everything for an empty query', () => {
    expect(matchesSetting(entries[0], '   ')).toBe(true);
  });

  it('matches on label, description and keywords', () => {
    expect(matchesSetting(entries[0], 'profile')).toBe(true);
    expect(matchesSetting(entries[0], 'personal')).toBe(true);
    expect(matchesSetting(entries[0], 'avatar')).toBe(true);
    expect(matchesSetting(entries[0], 'password')).toBe(false);
  });

  it('requires every word to be found', () => {
    expect(matchesSetting(entries[1], 'password devices')).toBe(true);
    expect(matchesSetting(entries[1], 'password avatar')).toBe(false);
  });

  it('ignores accents in the query', () => {
    expect(matchesSetting(entry('profile', 'Übersicht', '', ''), 'ubersicht')).toBe(true);
  });
});

describe('groupSettings', () => {
  it('keeps the fixed group order and drops empty groups', () => {
    const result = groupSettings(entries, '');
    expect(result.map((group) => group.group)).toEqual(['personal', 'preferences', 'data']);
  });

  it('filters entries inside groups', () => {
    const result = groupSettings(entries, 'reminders');
    expect(result).toHaveLength(1);
    expect(result[0].group).toBe('preferences');
    expect(result[0].entries.map((candidate) => candidate.item.id)).toEqual(['notifications']);
  });

  it('returns nothing when no entry matches', () => {
    expect(groupSettings(entries, 'zzz')).toEqual([]);
  });
});

describe('catalog', () => {
  it('has a unique id and href per item', () => {
    const ids = allSettingsItems.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of allSettingsItems) {
      expect(item.href).toBe(`/settings/${item.id}`);
    }
  });
});

describe('isSettingsOverviewPath', () => {
  it('is true only for the start page', () => {
    expect(isSettingsOverviewPath('/settings')).toBe(true);
    expect(isSettingsOverviewPath('/settings/')).toBe(true);
    expect(isSettingsOverviewPath('/settings/profile')).toBe(false);
  });
});
