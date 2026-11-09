/**
 * Field by field comparison of the two sides of a CardDAV sync conflict, and a
 * recommendation for which side to keep. Pure, so the conflict page only has to
 * draw the result.
 */

export interface ConflictPersonData {
  name?: string | null;
  surname?: string | null;
  middleName?: string | null;
  prefix?: string | null;
  suffix?: string | null;
  secondLastName?: string | null;
  nickname?: string | null;
  organization?: string | null;
  jobTitle?: string | null;
  gender?: string | null;
  birthday?: string | null;
  anniversary?: string | null;
  notes?: string | null;
  phoneNumbers?: Array<{ type: string; number: string }>;
  emails?: Array<{ type: string; email: string }>;
  addresses?: Array<{
    type: string;
    streetLine1?: string | null;
    streetLine2?: string | null;
    locality?: string | null;
    region?: string | null;
    postalCode?: string | null;
    country?: string | null;
  }>;
  urls?: Array<{ type: string; url: string }>;
  imHandles?: Array<{ protocol: string; handle: string }>;
  locations?: Array<{ type: string; latitude: number; longitude: number }>;
  customFields?: Array<{ key: string; value: string }>;
}

export type ScalarFieldKey =
  | 'name' | 'surname' | 'middleName' | 'prefix' | 'suffix' | 'secondLastName'
  | 'nickname' | 'organization' | 'jobTitle' | 'gender' | 'birthday' | 'anniversary' | 'notes';

export type ListFieldKey =
  | 'phones' | 'emails' | 'addresses' | 'urls' | 'imHandles' | 'locations' | 'customFields';

export type ConflictFieldKey = ScalarFieldKey | ListFieldKey;

/** Same order as the old table, which is the order people know from the person page. */
export const SCALAR_FIELD_KEYS: readonly ScalarFieldKey[] = [
  'name', 'surname', 'middleName', 'prefix', 'suffix', 'secondLastName', 'nickname',
  'organization', 'jobTitle', 'gender', 'birthday', 'anniversary', 'notes',
];

export const LIST_FIELD_KEYS: readonly ListFieldKey[] = [
  'phones', 'emails', 'addresses', 'urls', 'imHandles', 'locations', 'customFields',
];

export type FieldStatus = 'changed' | 'localOnly' | 'remoteOnly';

export interface FieldDiff {
  key: ConflictFieldKey;
  kind: 'scalar' | 'list';
  /** One entry for a scalar field, one per value for a list field. Empty when the side has nothing. */
  local: string[];
  remote: string[];
  /** Values that exist on one side only (list fields), used to highlight single entries. */
  onlyLocal: string[];
  onlyRemote: string[];
  status: FieldStatus;
}

export interface ConflictComparison {
  /** Fields whose values differ, in display order. */
  different: FieldDiff[];
  /** Fields with the same value on both sides, shown collapsed. */
  sameKeys: ConflictFieldKey[];
}

export function parseVersion(version: string): ConflictPersonData {
  try {
    const parsed: unknown = JSON.parse(version);
    return typeof parsed === 'object' && parsed !== null ? (parsed as ConflictPersonData) : {};
  } catch {
    return {};
  }
}

function normalizeScalar(key: ScalarFieldKey, value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = value.replace(/\r\n/g, '\n').trim();
  if ((key === 'birthday' || key === 'anniversary') && /^\d{4}-\d{2}-\d{2}/.test(text)) {
    text = text.slice(0, 10);
  }
  return text;
}

function clean(parts: Array<string | null | undefined>): string {
  return parts.filter((p) => p !== null && p !== undefined && p !== '').join(', ');
}

function listValues(key: ListFieldKey, data: ConflictPersonData): string[] {
  switch (key) {
    case 'phones':
      return (data.phoneNumbers ?? []).map((p) => `${p.number} (${p.type})`);
    case 'emails':
      return (data.emails ?? []).map((e) => `${e.email} (${e.type})`);
    case 'addresses':
      return (data.addresses ?? []).map(
        (a) => `${clean([a.streetLine1, a.streetLine2, a.locality, a.region, a.postalCode, a.country])} (${a.type})`,
      );
    case 'urls':
      return (data.urls ?? []).map((u) => `${u.url} (${u.type})`);
    case 'imHandles':
      return (data.imHandles ?? []).map((h) => `${h.handle} (${h.protocol})`);
    case 'locations':
      return (data.locations ?? []).map((l) => `${l.latitude}, ${l.longitude} (${l.type})`);
    case 'customFields':
      return (data.customFields ?? []).map((f) => `${f.key}: ${f.value}`);
  }
}

function sameMembers(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, i) => value === sortedB[i]);
}

export function compareVersions(local: ConflictPersonData, remote: ConflictPersonData): ConflictComparison {
  const different: FieldDiff[] = [];
  const sameKeys: ConflictFieldKey[] = [];

  for (const key of SCALAR_FIELD_KEYS) {
    const l = normalizeScalar(key, local[key]);
    const r = normalizeScalar(key, remote[key]);
    if (!l && !r) continue;
    if (l === r) {
      sameKeys.push(key);
      continue;
    }
    different.push({
      key,
      kind: 'scalar',
      local: l ? [l] : [],
      remote: r ? [r] : [],
      onlyLocal: l ? [l] : [],
      onlyRemote: r ? [r] : [],
      status: !l ? 'remoteOnly' : !r ? 'localOnly' : 'changed',
    });
  }

  for (const key of LIST_FIELD_KEYS) {
    const l = listValues(key, local);
    const r = listValues(key, remote);
    if (l.length === 0 && r.length === 0) continue;
    // Order is irrelevant: servers often return the same numbers in another order.
    if (sameMembers(l, r)) {
      sameKeys.push(key);
      continue;
    }
    const rSet = new Set(r);
    const lSet = new Set(l);
    different.push({
      key,
      kind: 'list',
      local: l,
      remote: r,
      onlyLocal: l.filter((v) => !rSet.has(v)),
      onlyRemote: r.filter((v) => !lSet.has(v)),
      status: l.length === 0 ? 'remoteOnly' : r.length === 0 ? 'localOnly' : 'changed',
    });
  }

  return { different, sameKeys };
}

export type ResolutionChoice = 'keep_local' | 'keep_remote';

export type RecommendationReason =
  /** Both sides hold the same data. */
  | 'identical'
  /** The server only has details that Nametag lacks, so keeping the server loses nothing. */
  | 'serverAdds'
  /** Nametag only has details that the server lacks, so keeping Nametag loses nothing. */
  | 'localAdds'
  /** Both sides changed the same fields. Only the person can decide. */
  | 'differs';

export interface Recommendation {
  choice: ResolutionChoice | null;
  reason: RecommendationReason;
  /** True when keeping the recommended side cannot lose any value. */
  safe: boolean;
}

/**
 * Keeping a side is only recommended when it cannot lose information: the two
 * versions are the same, or one side merely adds to the other. Whenever both
 * sides hold different values for the same field there is no right answer to
 * suggest, because the sync log does not say which edit is newer.
 */
export function recommendResolution(comparison: ConflictComparison): Recommendation {
  const { different } = comparison;
  if (different.length === 0) {
    return { choice: 'keep_local', reason: 'identical', safe: true };
  }
  // Keeping a side loses exactly the values that only the other side has.
  const serverLosesNothing = different.every((d) => d.onlyLocal.length === 0);
  const localLosesNothing = different.every((d) => d.onlyRemote.length === 0);
  if (serverLosesNothing) return { choice: 'keep_remote', reason: 'serverAdds', safe: true };
  if (localLosesNothing) return { choice: 'keep_local', reason: 'localAdds', safe: true };
  return { choice: null, reason: 'differs', safe: false };
}
