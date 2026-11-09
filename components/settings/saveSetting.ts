export type SaveResult = { ok: true } | { ok: false; error: string | null };

/**
 * Sends one settings change to its API route and reports the outcome.
 *
 * The caller decides what to show. `error` carries the server's own message
 * when it sent one, and is null for a network failure or an unreadable
 * response, so the caller can fall back to a translated generic message.
 */
export async function saveSetting(
  url: string,
  body: unknown,
  method: 'PUT' | 'POST' = 'PUT'
): Promise<SaveResult> {
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      return { ok: true };
    }

    let error: string | null = null;
    try {
      const data: unknown = await response.json();
      if (typeof data === 'object' && data !== null && 'error' in data) {
        const candidate = (data as { error: unknown }).error;
        if (typeof candidate === 'string' && candidate) {
          error = candidate;
        }
      }
    } catch {
      // Not JSON; the caller shows its own message.
    }
    return { ok: false, error };
  } catch {
    return { ok: false, error: null };
  }
}
