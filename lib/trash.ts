/**
 * Shared types and pure helpers for the trash page (settings > trash).
 */

import { normalizeForSearch } from '@/lib/search';

export type EntityType =
  | 'people'
  | 'groups'
  | 'relationships'
  | 'relationshipTypes'
  | 'importantDates';

export const ENTITY_TYPES: EntityType[] = [
  'people',
  'groups',
  'relationships',
  'relationshipTypes',
  'importantDates',
];

export const DEFAULT_RETENTION_DAYS = 30;

interface NamedPerson {
  id: string;
  name: string;
  surname: string | null;
}

export interface DeletedPerson {
  id: string;
  name: string;
  surname: string | null;
  nickname: string | null;
  displayNameOverride: string | null;
  deletedAt: string;
}

export interface DeletedGroup {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  deletedAt: string;
}

export interface DeletedRelationship {
  id: string;
  deletedAt: string;
  person: NamedPerson;
  relatedPerson: NamedPerson;
  relationshipType: { id: string; label: string } | null;
}

export interface DeletedRelationshipType {
  id: string;
  name: string;
  label: string;
  color: string | null;
  deletedAt: string;
}

export interface DeletedImportantDate {
  id: string;
  title: string;
  date: string;
  deletedAt: string;
  person: NamedPerson;
}

export type DeletedItem =
  | DeletedPerson
  | DeletedGroup
  | DeletedRelationship
  | DeletedRelationshipType
  | DeletedImportantDate;

/** A trashed item together with its type, so mixed lists stay unambiguous. */
export interface TrashEntry {
  type: EntityType;
  item: DeletedItem;
}

export function entryKey(entry: TrashEntry): string {
  return `${entry.type}:${entry.item.id}`;
}

export function formatPersonName(person: { name: string; surname: string | null }): string {
  return person.surname ? `${person.name} ${person.surname}` : person.name;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days left before the purge job removes the item (0 means under a day). */
export function getDaysRemaining(
  deletedAt: string,
  retentionDays: number = DEFAULT_RETENTION_DAYS,
  now: Date = new Date()
): number {
  const diffMs = new Date(deletedAt).getTime() + retentionDays * DAY_MS - now.getTime();
  return Math.max(0, Math.ceil(diffMs / DAY_MS));
}

/** Items with a week or less left are highlighted. */
export function isRemovalUrgent(days: number): boolean {
  return days <= 7;
}

export function getRestoreUrl(type: EntityType, item: DeletedItem): string {
  switch (type) {
    case 'people':
      return `/api/people/${item.id}/restore`;
    case 'groups':
      return `/api/groups/${item.id}/restore`;
    case 'relationships':
      return `/api/relationships/${item.id}/restore`;
    case 'relationshipTypes':
      return `/api/relationship-types/${item.id}/restore`;
    case 'importantDates': {
      const date = item as DeletedImportantDate;
      return `/api/people/${date.person.id}/important-dates/${date.id}/restore`;
    }
  }
}

export function getPermanentDeleteUrl(type: EntityType, item: DeletedItem): string {
  switch (type) {
    case 'people':
      return `/api/people/${item.id}/permanent`;
    case 'groups':
      return `/api/groups/${item.id}/permanent`;
    case 'relationships':
      return `/api/relationships/${item.id}/permanent`;
    case 'relationshipTypes':
      return `/api/relationship-types/${item.id}/permanent`;
    case 'importantDates': {
      const date = item as DeletedImportantDate;
      return `/api/people/${date.person.id}/important-dates/${date.id}/permanent`;
    }
  }
}

/**
 * Entries that disappear together with the given one. Restoring or deleting a
 * relationship also acts on its inverse (same two people, opposite direction).
 */
export function getLinkedEntries(entry: TrashEntry, all: TrashEntry[]): TrashEntry[] {
  if (entry.type !== 'relationships') return [entry];
  const rel = entry.item as DeletedRelationship;
  return all.filter((other) => {
    if (other.type !== 'relationships') return false;
    if (other.item.id === rel.id) return true;
    const o = other.item as DeletedRelationship;
    return o.person.id === rel.relatedPerson.id && o.relatedPerson.id === rel.person.id;
  });
}

/** Plain text of an entry, used for searching. Dates are matched by title only. */
export function getSearchText(entry: TrashEntry): string {
  const { type, item } = entry;
  switch (type) {
    case 'people': {
      const p = item as DeletedPerson;
      return [p.name, p.surname, p.nickname, p.displayNameOverride].filter(Boolean).join(' ');
    }
    case 'groups': {
      const g = item as DeletedGroup;
      return [g.name, g.description].filter(Boolean).join(' ');
    }
    case 'relationships': {
      const r = item as DeletedRelationship;
      return [formatPersonName(r.person), r.relationshipType?.label, formatPersonName(r.relatedPerson)]
        .filter(Boolean)
        .join(' ');
    }
    case 'relationshipTypes': {
      const rt = item as DeletedRelationshipType;
      return [rt.label, rt.name].join(' ');
    }
    case 'importantDates': {
      const d = item as DeletedImportantDate;
      return [d.title, formatPersonName(d.person)].join(' ');
    }
  }
}

/** Keep entries whose text contains every word of the query (accent- and case-insensitive). */
export function filterEntries(entries: TrashEntry[], query: string): TrashEntry[] {
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return entries;
  return entries.filter((entry) => {
    const text = normalizeForSearch(getSearchText(entry));
    return words.every((word) => text.includes(word));
  });
}

/** Flatten per-type lists into one list, most recently deleted first. */
export function mergeEntries(byType: Record<EntityType, DeletedItem[]>): TrashEntry[] {
  const entries: TrashEntry[] = ENTITY_TYPES.flatMap((type) =>
    byType[type].map((item) => ({ type, item }))
  );
  return entries.sort(
    (a, b) => new Date(b.item.deletedAt).getTime() - new Date(a.item.deletedAt).getTime()
  );
}

export function emptyItemsByType(): Record<EntityType, DeletedItem[]> {
  return { people: [], groups: [], relationships: [], relationshipTypes: [], importantDates: [] };
}
