/**
 * Browser-side helpers shared by the merge page and the one-step merge dialog:
 * load a contact in comparison shape and send the merge request.
 */

import type { PersonForCompare } from '@/lib/merge-compare';

interface ApiRelationshipToUser {
  id: string;
  name: string;
  label: string;
  color: string | null;
}

interface ApiRelationshipFrom {
  id: string;
  relatedPerson: { id: string; name: string };
}

export interface ApiPersonForCompare
  extends Omit<PersonForCompare, 'relationshipToUser' | 'relationshipsFrom' | 'relationshipsTo'> {
  relationshipToUser: ApiRelationshipToUser | null;
  relationshipsFrom?: ApiRelationshipFrom[];
  relationshipsTo?: Array<{ id: string }>;
}

export function mapApiPersonToCompare(apiPerson: ApiPersonForCompare): PersonForCompare {
  return {
    ...apiPerson,
    relationshipToUser: apiPerson.relationshipToUser
      ? {
          id: apiPerson.relationshipToUser.id,
          name: apiPerson.relationshipToUser.label,
        }
      : null,
    relationshipsFrom: apiPerson.relationshipsFrom?.map((r) => ({ id: r.id })),
    relationshipsTo: apiPerson.relationshipsTo,
  };
}

/** Load one contact for comparison. Resolves to null when it cannot be loaded. */
export async function fetchPersonForCompare(id: string): Promise<PersonForCompare | null> {
  const res = await fetch(`/api/people/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const data: { person: ApiPersonForCompare } = await res.json();
  return mapApiPersonToCompare(data.person);
}

export type MergeRequestResult = { ok: true } | { ok: false; error: string | null };

/** Merge `secondaryId` into `primaryId`, taking the given field values from the secondary. */
export async function requestMerge(
  primaryId: string,
  secondaryId: string,
  fieldOverrides: Record<string, string | null>
): Promise<MergeRequestResult> {
  try {
    const res = await fetch('/api/people/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        primaryId,
        secondaryId,
        fieldOverrides: Object.keys(fieldOverrides).length > 0 ? fieldOverrides : undefined,
      }),
    });
    if (res.ok) return { ok: true };
    const data: { error?: string } = await res.json().catch(() => ({}));
    return { ok: false, error: data.error ?? null };
  } catch {
    return { ok: false, error: null };
  }
}
