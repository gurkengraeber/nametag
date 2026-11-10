import type { SettingsGroupId, SettingsItem } from './settingsCatalog';
import { SETTINGS_GROUP_ORDER } from './settingsCatalog';
import { normalizeForSearch } from '@/lib/search';

/** A settings entry with its text already translated, ready to be searched. */
export interface SearchableSetting {
  item: SettingsItem;
  label: string;
  description: string;
  /** Extra words people might type, from settings.search.keywords. */
  keywords: string;
}

/**
 * Every word the person typed has to appear somewhere in the label,
 * description or keywords. An empty query matches everything.
 */
export function matchesSetting(entry: SearchableSetting, query: string): boolean {
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeForSearch(`${entry.label} ${entry.description} ${entry.keywords}`);
  return words.every((word) => haystack.includes(word));
}

export interface SettingsGroupResult {
  group: SettingsGroupId;
  entries: SearchableSetting[];
}

/** Filters by the query and groups the result in the fixed group order, dropping empty groups. */
export function groupSettings(entries: SearchableSetting[], query: string): SettingsGroupResult[] {
  return SETTINGS_GROUP_ORDER.map((group) => ({
    group,
    entries: entries.filter((entry) => entry.item.group === group && matchesSetting(entry, query)),
  })).filter((result) => result.entries.length > 0);
}

/** True when the pathname is the settings start page, with or without a trailing slash. */
export function isSettingsOverviewPath(pathname: string): boolean {
  return pathname.replace(/\/+$/, '') === '/settings';
}
