/**
 * Pure helpers for comparing two contacts before merging them.
 *
 * Used by the merge page (PersonCompare) and the one-step merge dialog on the
 * duplicates page, so both preselect the same values and describe the same
 * outcome. The deduplication rules mirror mergePeople() in
 * lib/services/person.ts and must stay in sync with it.
 */

export interface PersonForCompare {
  id: string;
  name: string;
  surname: string | null;
  middleName: string | null;
  secondLastName: string | null;
  nickname: string | null;
  displayNameOverride?: string | null;
  prefix: string | null;
  suffix: string | null;
  organization: string | null;
  jobTitle: string | null;
  gender: string | null;
  anniversary: string | Date | null;
  lastContact: string | Date | null;
  photo: string | null;
  notes: string | null;
  updatedAt?: string | Date | null;
  relationshipToUserId: string | null;
  relationshipToUser: { id: string; name: string } | null;
  phoneNumbers: Array<{ type: string; number: string }>;
  emails: Array<{ type: string; email: string }>;
  addresses: Array<{
    type: string;
    streetLine1?: string | null;
    streetLine2?: string | null;
    locality?: string | null;
    region?: string | null;
    postalCode?: string | null;
    country?: string | null;
  }>;
  urls: Array<{ type: string; url: string }>;
  imHandles: Array<{ protocol: string; handle: string }>;
  locations: Array<{ type: string; latitude: number; longitude: number }>;
  customFields: Array<{ key: string; value: string }>;
  customFieldValues: Array<{
    templateId: string;
    value: string;
    template: { id: string; name: string };
  }>;
  importantDates: Array<{ title: string; date: string | Date }>;
  groups: Array<{ group: { id: string; name: string } }>;
  relationshipsFrom?: Array<{ id: string }>;
  relationshipsTo?: Array<{ id: string }>;
}

export interface MergeSelections {
  primaryId: string;
  fieldOverrides: Record<string, string | null>;
}

export type ScalarFieldKey =
  | 'name'
  | 'surname'
  | 'middleName'
  | 'secondLastName'
  | 'nickname'
  | 'displayNameOverride'
  | 'prefix'
  | 'suffix'
  | 'organization'
  | 'jobTitle'
  | 'gender'
  | 'anniversary'
  | 'lastContact'
  | 'photo'
  | 'notes';

export interface ScalarFieldDef {
  key: ScalarFieldKey;
  labelKey: string;
}

export const SCALAR_FIELDS: ScalarFieldDef[] = [
  { key: 'name', labelKey: 'fieldName' },
  { key: 'surname', labelKey: 'fieldSurname' },
  { key: 'middleName', labelKey: 'fieldMiddleName' },
  { key: 'secondLastName', labelKey: 'fieldSecondLastName' },
  { key: 'nickname', labelKey: 'fieldNickname' },
  { key: 'displayNameOverride', labelKey: 'fieldDisplayNameOverride' },
  { key: 'prefix', labelKey: 'fieldPrefix' },
  { key: 'suffix', labelKey: 'fieldSuffix' },
  { key: 'organization', labelKey: 'fieldOrganization' },
  { key: 'jobTitle', labelKey: 'fieldJobTitle' },
  { key: 'gender', labelKey: 'fieldGender' },
  { key: 'anniversary', labelKey: 'fieldAnniversary' },
  { key: 'lastContact', labelKey: 'fieldLastContact' },
  { key: 'photo', labelKey: 'fieldPhoto' },
  { key: 'notes', labelKey: 'fieldNotes' },
];

/** Key under which a relationship-to-user choice is stored in fieldOverrides. */
export const REL_TO_USER_OVERRIDE_KEY = 'relationshipToUserId';

export function formatPersonLabel(person: { name: string; surname: string | null }): string {
  return [person.name, person.surname].filter(Boolean).join(' ');
}

const DATE_KEYS: ReadonlySet<ScalarFieldKey> = new Set(['anniversary', 'lastContact']);

/**
 * The value as text. Dates are cut to the day: the API sends full timestamps,
 * but the merge request only accepts YYYY-MM-DD and two timestamps for the
 * same day must not count as a conflict.
 */
export function getScalarValue(
  person: PersonForCompare,
  key: ScalarFieldKey
): string | null {
  const raw = person[key];
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) {
    return raw.toISOString().split('T')[0];
  }
  if (typeof raw === 'string' && raw.trim() === '') return null;
  if (DATE_KEYS.has(key) && /^\d{4}-\d{2}-\d{2}T/.test(String(raw))) {
    return String(raw).slice(0, 10);
  }
  return String(raw);
}

/** Text shown for a scalar value; dates use the viewer's locale. */
export function formatFieldValue(value: string | null, key: ScalarFieldKey): string {
  if (value === null) return '';
  if (
    (key === 'anniversary' || key === 'lastContact') &&
    /^\d{4}-\d{2}-\d{2}/.test(value)
  ) {
    // Built from the parts so the day does not slip back west of UTC
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
  }
  return value;
}

export function countNonEmptyFields(person: PersonForCompare): number {
  let count = 0;
  for (const { key } of SCALAR_FIELDS) {
    if (getScalarValue(person, key) !== null) count++;
  }
  if (person.relationshipToUserId) count++;
  count += person.phoneNumbers.length;
  count += person.emails.length;
  count += person.addresses.length;
  count += person.urls.length;
  count += person.imHandles.length;
  count += person.locations.length;
  count += person.customFields.length;
  count += person.customFieldValues.length;
  count += person.importantDates.length;
  count += person.groups.length;
  return count;
}

function toTime(value: string | Date | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

// ---------------------------------------------------------------------------
// Field comparison
// ---------------------------------------------------------------------------

/**
 * - conflict: both have a value and the values differ
 * - same: both have the same value
 * - oneSide: exactly one contact has a value (it is kept automatically)
 * - empty: neither has a value
 */
export type FieldStatus = 'conflict' | 'same' | 'oneSide' | 'empty';

function statusOf(valA: string | null, valB: string | null, sameValue: boolean): FieldStatus {
  if (valA === null && valB === null) return 'empty';
  if (valA === null || valB === null) return 'oneSide';
  return sameValue ? 'same' : 'conflict';
}

export interface ScalarFieldState {
  key: ScalarFieldKey;
  labelKey: string;
  valA: string | null;
  valB: string | null;
  status: FieldStatus;
}

export function compareScalarFields(
  personA: PersonForCompare,
  personB: PersonForCompare
): ScalarFieldState[] {
  return SCALAR_FIELDS.map(({ key, labelKey }) => {
    const valA = getScalarValue(personA, key);
    const valB = getScalarValue(personB, key);
    return { key, labelKey, valA, valB, status: statusOf(valA, valB, valA === valB) };
  });
}

export interface RelationshipToUserState {
  valA: string | null;
  valB: string | null;
  status: FieldStatus;
}

export function compareRelationshipToUser(
  personA: PersonForCompare,
  personB: PersonForCompare
): RelationshipToUserState {
  const valA = personA.relationshipToUser?.name ?? null;
  const valB = personB.relationshipToUser?.name ?? null;
  return {
    valA,
    valB,
    status: statusOf(valA, valB, personA.relationshipToUserId === personB.relationshipToUserId),
  };
}

// ---------------------------------------------------------------------------
// Preselection
// ---------------------------------------------------------------------------

/**
 * The contact with more filled-in data is kept as the primary one. On a tie
 * the more recently edited contact wins, then the first one.
 */
export function pickInitialPrimaryId(
  personA: PersonForCompare,
  personB: PersonForCompare
): string {
  const countA = countNonEmptyFields(personA);
  const countB = countNonEmptyFields(personB);
  if (countA !== countB) return countA > countB ? personA.id : personB.id;
  const timeA = toTime(personA.updatedAt);
  const timeB = toTime(personB.updatedAt);
  if (timeA !== null && timeB !== null && timeA !== timeB) {
    return timeA > timeB ? personA.id : personB.id;
  }
  return personA.id;
}

/**
 * Preselect a value for every conflicting field so the common case needs no
 * clicks: the value of the more recently edited contact wins, and for the
 * last contact date the later date wins. Fields only one contact fills in are
 * not listed, the merge keeps them automatically.
 *
 * Returns overrides in the shape of the merge API: an entry means "take the
 * secondary contact's value", no entry means "keep the primary's value".
 */
export function buildDefaultOverrides(
  primary: PersonForCompare,
  secondary: PersonForCompare
): Record<string, string | null> {
  const overrides: Record<string, string | null> = {};
  const primaryTime = toTime(primary.updatedAt);
  const secondaryTime = toTime(secondary.updatedAt);
  const secondaryIsNewer =
    primaryTime !== null && secondaryTime !== null && secondaryTime > primaryTime;

  for (const field of compareScalarFields(primary, secondary)) {
    if (field.status !== 'conflict') continue;
    let takeSecondary = secondaryIsNewer;
    if (field.key === 'lastContact') {
      const lastPrimary = toTime(field.valA);
      const lastSecondary = toTime(field.valB);
      if (lastPrimary !== null && lastSecondary !== null) {
        takeSecondary = lastSecondary > lastPrimary;
      }
    }
    if (takeSecondary) overrides[field.key] = field.valB;
  }

  const rel = compareRelationshipToUser(primary, secondary);
  if (rel.status === 'conflict' && secondaryIsNewer) {
    overrides[REL_TO_USER_OVERRIDE_KEY] = secondary.relationshipToUserId;
  }

  return overrides;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface MultiValueSummary {
  fieldKey: string;
  labelKey: string;
  /** Entries on the merged contact. */
  total: number;
  /** Entries that come over from the secondary contact. */
  added: number;
}

export interface MergeSummary {
  multiValue: MultiValueSummary[];
  groups: { total: number; added: number };
  /** Relationships of the secondary contact that are re-attached to the primary. */
  secondaryRelationships: number;
  /** Fields only the secondary contact fills in, which the primary adopts. */
  adoptedFields: number;
  /** Conflicting fields where the secondary's value was chosen. */
  secondaryValuesChosen: number;
}

function addressKey(a: PersonForCompare['addresses'][number]): string {
  return [a.streetLine1, a.streetLine2, a.locality, a.region, a.postalCode, a.country]
    .map((v) => (v ?? '').toLowerCase().trim())
    .join('|');
}

function dateKey(d: PersonForCompare['importantDates'][number]): string {
  return `${d.title}:${d.date instanceof Date ? d.date.toISOString() : d.date}`;
}

function countNew<T>(items: T[], seen: Set<string>, keyOf: (item: T) => string): number {
  return items.filter((item) => !seen.has(keyOf(item))).length;
}

/**
 * Describe what a merge will do, using the same deduplication rules as the
 * server so the counts shown before confirming match the result.
 */
export function summarizeMerge(
  primary: PersonForCompare,
  secondary: PersonForCompare,
  overrides: Record<string, string | null> = {}
): MergeSummary {
  const rows: Array<{ fieldKey: string; labelKey: string; total: number; added: number }> = [];

  const push = (fieldKey: string, labelKey: string, primaryCount: number, added: number) => {
    rows.push({ fieldKey, labelKey, total: primaryCount + added, added });
  };

  push(
    'phoneNumbers', 'phones', primary.phoneNumbers.length,
    countNew(secondary.phoneNumbers, new Set(primary.phoneNumbers.map((p) => p.number)), (p) => p.number)
  );
  push(
    'emails', 'emails', primary.emails.length,
    countNew(secondary.emails, new Set(primary.emails.map((e) => e.email.toLowerCase())), (e) => e.email.toLowerCase())
  );
  push(
    'addresses', 'addresses', primary.addresses.length,
    countNew(secondary.addresses, new Set(primary.addresses.map(addressKey)), addressKey)
  );
  push(
    'urls', 'urls', primary.urls.length,
    countNew(secondary.urls, new Set(primary.urls.map((u) => u.url.toLowerCase())), (u) => u.url.toLowerCase())
  );
  const imKey = (im: { protocol: string; handle: string }) => `${im.protocol}:${im.handle}`.toLowerCase();
  push(
    'imHandles', 'imHandles', primary.imHandles.length,
    countNew(secondary.imHandles, new Set(primary.imHandles.map(imKey)), imKey)
  );
  const locKey = (l: { latitude: number; longitude: number }) => `${l.latitude},${l.longitude}`;
  push(
    'locations', 'locations', primary.locations.length,
    countNew(secondary.locations, new Set(primary.locations.map(locKey)), locKey)
  );
  const cfKey = (f: { key: string; value: string }) => `${f.key}:${f.value}`;
  push(
    'customFields', 'customFields', primary.customFields.length,
    countNew(secondary.customFields, new Set(primary.customFields.map(cfKey)), cfKey)
  );
  // Template-backed values are unique per template, the primary's value wins.
  push(
    'customFieldValues', 'customFieldValues', primary.customFieldValues.length,
    countNew(
      secondary.customFieldValues,
      new Set(primary.customFieldValues.map((v) => v.templateId)),
      (v) => v.templateId
    )
  );
  push(
    'importantDates', 'importantDates', primary.importantDates.length,
    countNew(secondary.importantDates, new Set(primary.importantDates.map(dateKey)), dateKey)
  );

  const primaryGroupIds = new Set(primary.groups.map((g) => g.group.id));
  const groupsAdded = countNew(secondary.groups, primaryGroupIds, (g) => g.group.id);

  const states = compareScalarFields(primary, secondary);
  const adoptedFields =
    states.filter((s) => s.status === 'oneSide' && s.valA === null).length +
    (primary.relationshipToUserId === null && secondary.relationshipToUserId !== null ? 1 : 0);
  const secondaryValuesChosen = Object.keys(overrides).length;

  return {
    multiValue: rows.filter((r) => r.total > 0),
    groups: { total: primary.groups.length + groupsAdded, added: groupsAdded },
    secondaryRelationships:
      (secondary.relationshipsFrom?.length ?? 0) + (secondary.relationshipsTo?.length ?? 0),
    adoptedFields,
    secondaryValuesChosen,
  };
}

/** True when the secondary contact's value is selected for this field. */
export function isSecondarySelected(
  fieldKey: string,
  overrides: Record<string, string | null>
): boolean {
  return fieldKey === 'relationshipToUser'
    ? REL_TO_USER_OVERRIDE_KEY in overrides
    : fieldKey in overrides;
}
