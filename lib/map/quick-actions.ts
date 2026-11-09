import { getLocalDateString } from '@/lib/date-format';
import type { UnplacedAddress } from './types';

/**
 * Small client-side wrappers around the existing API routes, so the map can
 * edit a contact without leaving the page. Each returns true on success.
 */

async function send(url: string, method: string, body: unknown): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function personUrl(personId: string): string {
  return `/api/people/${encodeURIComponent(personId)}`;
}

/** Sets the last contact of a person to today (local date). */
export async function markContactedToday(personId: string, today: string = getLocalDateString()): Promise<boolean> {
  return send(personUrl(personId), 'PUT', { lastContact: today });
}

/** Sets or clears (null) the relationship of a person to the user. */
export async function setPersonRelationship(personId: string, relationshipTypeId: string | null): Promise<boolean> {
  return send(personUrl(personId), 'PUT', { relationshipToUserId: relationshipTypeId });
}

/**
 * Adds one person to one group through the bulk route with an explicit id
 * list. `selectAll` is deliberately never used. Adding a person that is
 * already a member is a no-op on the server.
 */
export async function addPersonToGroup(personId: string, groupId: string): Promise<boolean> {
  return send('/api/people/bulk', 'POST', { action: 'addToGroups', personIds: [personId], groupIds: [groupId] });
}

/**
 * Saves the complete address list of a person. The person update route
 * replaces all addresses and starts geocoding in the background; the map picks
 * the result up on its next refresh.
 */
export async function savePersonAddresses(personId: string, addresses: readonly UnplacedAddress[]): Promise<boolean> {
  return send(personUrl(personId), 'PUT', { addresses });
}
