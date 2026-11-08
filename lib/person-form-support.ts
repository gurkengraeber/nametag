/**
 * Pure helpers for the person form: remembered defaults for new people and
 * mapping of server validation errors onto the field they belong to.
 */

export const PERSON_FORM_DEFAULTS_KEY = 'nametag.newPerson.defaults';

export interface PersonFormDefaults {
  relationshipToUserId: string;
  groupIds: string[];
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getBrowserStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Reads the remembered defaults. Never throws; returns null when unavailable or invalid. */
export function loadPersonFormDefaults(
  storage: StorageLike | null = getBrowserStorage()
): PersonFormDefaults | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(PERSON_FORM_DEFAULTS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const relationshipToUserId =
      typeof record.relationshipToUserId === 'string' ? record.relationshipToUserId : '';
    const groupIds = Array.isArray(record.groupIds)
      ? record.groupIds.filter((id): id is string => typeof id === 'string')
      : [];
    return { relationshipToUserId, groupIds };
  } catch {
    return null;
  }
}

/** Remembers the defaults for the next new person. Failures are ignored. */
export function savePersonFormDefaults(
  defaults: PersonFormDefaults,
  storage: StorageLike | null = getBrowserStorage()
): void {
  if (!storage) return;
  try {
    storage.setItem(PERSON_FORM_DEFAULTS_KEY, JSON.stringify(defaults));
  } catch {
    // Storage can be full or blocked (private mode). Remembering is optional.
  }
}

/** Drops IDs of relationship types and groups that no longer exist. */
export function sanitizePersonFormDefaults(
  defaults: PersonFormDefaults,
  validRelationshipTypeIds: readonly string[],
  validGroupIds: readonly string[]
): PersonFormDefaults {
  return {
    relationshipToUserId: validRelationshipTypeIds.includes(defaults.relationshipToUserId)
      ? defaults.relationshipToUserId
      : '',
    groupIds: defaults.groupIds.filter((id) => validGroupIds.includes(id)),
  };
}

export type FieldIssue = 'required' | 'too_long' | 'too_short' | 'invalid_format' | 'invalid_value';

export interface PersonFormFieldError {
  issue: FieldIssue;
  max?: number;
  min?: number;
}

export type PersonFormFieldErrors = Record<string, PersonFormFieldError>;

const FIELD_ISSUES: readonly string[] = [
  'required',
  'too_long',
  'too_short',
  'invalid_format',
  'invalid_value',
];

function isFieldIssue(value: string): value is FieldIssue {
  return FIELD_ISSUES.includes(value);
}

/**
 * Maps the `fields` array of a validation_failed response ({ path, issue,
 * params }) to errors keyed by the top-level form field. Nested paths such as
 * `emails.0.email` collapse to their first segment (`emails`). The first issue
 * per field wins. Returns an empty object for anything else.
 */
export function mapServerFieldErrors(fields: unknown): PersonFormFieldErrors {
  const result: PersonFormFieldErrors = {};
  if (!Array.isArray(fields)) return result;
  for (const entry of fields as unknown[]) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.path !== 'string' || typeof record.issue !== 'string') continue;
    if (!isFieldIssue(record.issue)) continue;
    const key = record.path.split('.')[0];
    if (!key || key in result) continue;
    const params =
      typeof record.params === 'object' && record.params !== null
        ? (record.params as Record<string, unknown>)
        : {};
    result[key] = {
      issue: record.issue,
      ...(typeof params.max === 'number' ? { max: params.max } : {}),
      ...(typeof params.min === 'number' ? { min: params.min } : {}),
    };
  }
  return result;
}
