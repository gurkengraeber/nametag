/** True when any field differs from its saved value. */
export function hasChanges<T extends Record<string, string>>(current: T, saved: T): boolean {
  return (Object.keys(saved) as Array<keyof T>).some((key) => current[key] !== saved[key]);
}

export interface ApiErrorInfo {
  message: string | null;
  code: string | null;
  fields: Record<string, string>;
}

/**
 * Reads the error body every API route returns: a message, a machine code and,
 * for validation failures, a `details` list of { field, message }. Anything
 * unexpected yields an empty result rather than throwing, so a form can always
 * fall back to its own generic message.
 */
export function parseApiError(data: unknown): ApiErrorInfo {
  const info: ApiErrorInfo = { message: null, code: null, fields: {} };
  if (typeof data !== 'object' || data === null) return info;

  const body = data as { error?: unknown; code?: unknown; details?: unknown };
  if (typeof body.error === 'string' && body.error) info.message = body.error;
  if (typeof body.code === 'string' && body.code) info.code = body.code;

  if (Array.isArray(body.details)) {
    for (const entry of body.details) {
      if (typeof entry !== 'object' || entry === null) continue;
      const { field, message } = entry as { field?: unknown; message?: unknown };
      if (typeof field === 'string' && typeof message === 'string' && !(field in info.fields)) {
        info.fields[field] = message;
      }
    }
  }
  return info;
}

/**
 * Whether following a link would leave the current page. Links that only
 * change the hash stay on the page and must not trigger an unsaved changes
 * warning.
 */
export function isLeavingPage(
  href: string,
  location: { href: string }
): boolean {
  let target: URL;
  let here: URL;
  try {
    here = new URL(location.href);
    target = new URL(href, here);
  } catch {
    return false;
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return false;
  return (
    target.origin !== here.origin ||
    target.pathname !== here.pathname ||
    target.search !== here.search
  );
}
