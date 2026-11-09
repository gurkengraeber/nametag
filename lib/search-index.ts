import MiniSearch from 'minisearch';
import { normalizeForSearch } from '@/lib/search';

export interface SearchDocument {
  id: string;
  name: string;
  surname: string | null;
  middleName: string | null;
  secondLastName: string | null;
  nickname: string | null;
  displayNameOverride?: string | null;
  organization: string | null;
  jobTitle: string | null;
  notes: string | null;
  phones: string;
  emails: string;
  addresses: string;
  urls: string;
  imHandles: string;
  groups: string;
  customFields: string;
  photo: string | null;
  /** Label of the relationship to the user, for example "Friend". */
  relationship?: string | null;
  relationshipTypeId?: string | null;
  /** First city found in the person's addresses. */
  locality?: string | null;
  groupIds?: string[];
  groupNames?: string[];
  /** Date of the last contact as YYYY-MM-DD. */
  lastContact?: string | null;
}

/**
 * Fields that, when matched, explain why a result showed up. Name fields are
 * left out on purpose: a hit on the name needs no explanation.
 */
export type SearchMatchField =
  | 'group'
  | 'relationship'
  | 'locality'
  | 'organization'
  | 'jobTitle'
  | 'notes'
  | 'contact'
  | 'other';

export interface PersonSearchResult {
  id: string;
  name: string;
  surname: string | null;
  middleName: string | null;
  secondLastName: string | null;
  nickname: string | null;
  displayNameOverride: string | null;
  photo: string | null;
  score: number;
  relationship?: string | null;
  relationshipTypeId?: string | null;
  locality?: string | null;
  organization?: string | null;
  groupIds?: string[];
  groupNames?: string[];
  lastContact?: string | null;
  /** Set when a search word was found outside the name fields. */
  matchedIn?: SearchMatchField | null;
}

const INDEXED_FIELDS = [
  'name', 'surname', 'middleName', 'secondLastName', 'nickname', 'displayNameOverride',
  'organization', 'jobTitle', 'notes',
  'phones', 'emails', 'addresses', 'urls', 'imHandles',
  'groups', 'customFields', 'relationship', 'locality',
];

const STORED_FIELDS = [
  'id', 'name', 'surname', 'middleName', 'secondLastName', 'nickname', 'displayNameOverride', 'photo',
  'relationship', 'relationshipTypeId', 'locality', 'organization',
  'groupIds', 'groupNames', 'lastContact',
];

/**
 * Names and the things people remember someone by outrank free text. A person
 * called "Berlin" should come before someone whose notes mention the city.
 */
const FIELD_BOOST: Record<string, number> = {
  name: 4,
  surname: 4,
  middleName: 2,
  secondLastName: 3,
  nickname: 4,
  displayNameOverride: 4,
  organization: 1.5,
  jobTitle: 1.2,
  groups: 2,
  relationship: 2,
  locality: 2,
  notes: 0.6,
};

const NAME_FIELDS = new Set([
  'name', 'surname', 'middleName', 'secondLastName', 'nickname', 'displayNameOverride',
]);

/** Which hint to show for a matched field, in the order we prefer to show them. */
const MATCH_FIELD_PRIORITY: Array<{ field: string; hint: SearchMatchField }> = [
  { field: 'groups', hint: 'group' },
  { field: 'relationship', hint: 'relationship' },
  { field: 'locality', hint: 'locality' },
  { field: 'organization', hint: 'organization' },
  { field: 'jobTitle', hint: 'jobTitle' },
  { field: 'notes', hint: 'notes' },
  { field: 'emails', hint: 'contact' },
  { field: 'phones', hint: 'contact' },
  { field: 'addresses', hint: 'locality' },
  { field: 'urls', hint: 'other' },
  { field: 'imHandles', hint: 'other' },
  { field: 'customFields', hint: 'other' },
];

export function createSearchIndex(documents: SearchDocument[]): MiniSearch<SearchDocument> {
  const index = new MiniSearch<SearchDocument>({
    fields: INDEXED_FIELDS,
    storeFields: STORED_FIELDS,
    processTerm: (term) => normalizeForSearch(term) || null,
  });
  index.addAll(documents);
  return index;
}

/**
 * Typo tolerance only for words long enough to carry it. One wrong letter in a
 * three letter word is a different word, and it floods the list with noise.
 */
export function fuzzyForTerm(term: string): number | false {
  return term.length >= 4 ? 0.2 : false;
}

interface NameParts {
  name: string;
  surname?: string | null;
  middleName?: string | null;
  secondLastName?: string | null;
  nickname?: string | null;
  displayNameOverride?: string | null;
}

/**
 * Extra score for results whose name really starts with what was typed. The
 * full text score treats "Ann" in "Joanna" and in "Ann" alike, so without this
 * the person you meant is not reliably on top.
 */
export function nameMatchBonus(person: NameParts, query: string): number {
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;

  const nameWords = [
    person.name,
    person.surname,
    person.middleName,
    person.secondLastName,
    person.nickname,
    person.displayNameOverride,
  ]
    .filter((part): part is string => Boolean(part))
    .flatMap((part) => normalizeForSearch(part).split(/\s+/))
    .filter(Boolean);

  let bonus = 0;
  for (const word of words) {
    if (nameWords.includes(word)) {
      bonus += 6;
    } else if (nameWords.some((nameWord) => nameWord.startsWith(word))) {
      bonus += 3;
    }
  }

  // Typing the whole name, in either order, is the strongest signal there is.
  const full = normalizeForSearch([person.name, person.surname].filter(Boolean).join(' '));
  const reversed = normalizeForSearch([person.surname, person.name].filter(Boolean).join(' '));
  const typed = words.join(' ');
  if (typed === full || typed === reversed) {
    bonus += 10;
  }

  return bonus;
}

/**
 * Picks the most telling non-name field out of MiniSearch's match info. Only
 * words that matched nowhere in the name count, so searching "anna berlin"
 * explains the hit with the city rather than with a name.
 */
export function pickMatchHint(match: Record<string, string[]> | undefined): SearchMatchField | null {
  if (!match) return null;

  const hinted = new Set<string>();
  for (const fields of Object.values(match)) {
    if (fields.some((field) => NAME_FIELDS.has(field))) continue;
    for (const field of fields) hinted.add(field);
  }
  if (hinted.size === 0) return null;

  for (const { field, hint } of MATCH_FIELD_PRIORITY) {
    if (hinted.has(field)) return hint;
  }
  return null;
}

export function searchIndex(
  index: MiniSearch<SearchDocument>,
  query: string,
  maxResults = 20
): PersonSearchResult[] {
  if (!query.trim()) return [];

  // AND: all query words must appear on the same person
  const results = index.search(query, {
    fuzzy: fuzzyForTerm,
    prefix: true,
    combineWith: 'AND',
    boost: FIELD_BOOST,
  });

  const ranked = results
    .map((result) => {
      const person = {
        id: result.id as string,
        name: result.name as string,
        surname: (result.surname as string | null) ?? null,
        middleName: (result.middleName as string | null) ?? null,
        secondLastName: (result.secondLastName as string | null) ?? null,
        nickname: (result.nickname as string | null) ?? null,
        displayNameOverride: (result.displayNameOverride as string | null) ?? null,
        photo: (result.photo as string | null) ?? null,
        relationship: (result.relationship as string | null) ?? null,
        relationshipTypeId: (result.relationshipTypeId as string | null) ?? null,
        locality: (result.locality as string | null) ?? null,
        organization: (result.organization as string | null) ?? null,
        groupIds: (result.groupIds as string[] | undefined) ?? [],
        groupNames: (result.groupNames as string[] | undefined) ?? [],
        lastContact: (result.lastContact as string | null) ?? null,
      };
      return {
        ...person,
        score: result.score + nameMatchBonus(person, query),
        matchedIn: pickMatchHint(result.match),
      };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return ranked.slice(0, maxResults);
}

/** Looks a single person up by id without running a search. */
export function getIndexedPerson(
  index: MiniSearch<SearchDocument>,
  id: string
): PersonSearchResult | null {
  const stored = index.getStoredFields(id);
  if (!stored) return null;

  return {
    id,
    name: stored.name as string,
    surname: (stored.surname as string | null) ?? null,
    middleName: (stored.middleName as string | null) ?? null,
    secondLastName: (stored.secondLastName as string | null) ?? null,
    nickname: (stored.nickname as string | null) ?? null,
    displayNameOverride: (stored.displayNameOverride as string | null) ?? null,
    photo: (stored.photo as string | null) ?? null,
    relationship: (stored.relationship as string | null) ?? null,
    relationshipTypeId: (stored.relationshipTypeId as string | null) ?? null,
    locality: (stored.locality as string | null) ?? null,
    organization: (stored.organization as string | null) ?? null,
    groupIds: (stored.groupIds as string[] | undefined) ?? [],
    groupNames: (stored.groupNames as string[] | undefined) ?? [],
    lastContact: (stored.lastContact as string | null) ?? null,
    score: 0,
    matchedIn: null,
  };
}
