/**
 * Browser storage conventions for anything that touches people or accounts.
 *
 * Keys look like `nametag:<area>:<userId>`, so two accounts that share a
 * browser never read each other's data, and one prefix is enough to wipe
 * everything on sign-out. Store ids only, never names or notes.
 */
export const STORAGE_PREFIX = 'nametag:';

/** Entries older than this are dropped when read. */
export const STORAGE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function storageKey(area: string, userId: string): string {
  return `${STORAGE_PREFIX}${area}:${userId}`;
}

function clearPrefixed(storage: Storage): void {
  const doomed: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) doomed.push(key);
  }
  doomed.forEach((key) => storage.removeItem(key));
}

/**
 * Removes every `nametag:` key from local and session storage. Call it when the
 * user signs out. Blocked or unavailable storage is not an error.
 */
export function clearNametagStorage(): void {
  for (const getStorage of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      clearPrefixed(getStorage());
    } catch {
      // Storage can be blocked; there is nothing to clear then.
    }
  }
}
