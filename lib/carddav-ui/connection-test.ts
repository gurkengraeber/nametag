/**
 * Helpers around "Test connection": turning a failed request into a reason the
 * page can explain in plain words, and summarising the address books a
 * successful test found.
 */

export type TestFailureReason =
  | 'auth'
  | 'not_found'
  | 'timeout'
  | 'dns'
  | 'refused'
  | 'tls'
  | 'discovery'
  | 'unknown';

const KNOWN_REASONS: readonly TestFailureReason[] = [
  'auth', 'not_found', 'timeout', 'dns', 'refused', 'tls', 'discovery', 'unknown',
];

function errorText(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  // Node's fetch hides the real cause (ENOTFOUND, certificate errors) one or
  // two levels down, so walk the cause chain.
  for (let depth = 0; depth < 4 && current; depth++) {
    if (current instanceof Error) {
      parts.push(current.message);
      const code = (current as Error & { code?: unknown }).code;
      if (typeof code === 'string') parts.push(code);
      current = (current as Error & { cause?: unknown }).cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return parts.join(' ').toLowerCase();
}

/** Decide why a connection test failed, from the error thrown by the DAV client. */
export function classifyTestFailure(error: unknown): TestFailureReason {
  const text = errorText(error);
  if (/\b(401|403)\b|unauthori[sz]ed|invalid credentials|forbidden/.test(text)) return 'auth';
  if (/enotfound|eai_again|getaddrinfo/.test(text)) return 'dns';
  if (/econnrefused/.test(text)) return 'refused';
  if (/timeout|etimedout|timed out|econnreset|socket hang up/.test(text)) return 'timeout';
  if (/certificate|cert_|\bssl\b|\btls\b|self.signed|unable.to.verify/.test(text)) return 'tls';
  if (/\b404\b|not found/.test(text)) return 'not_found';
  if (/homeurl|home url|principal|cannot find|could not find|addressbook home/.test(text)) return 'discovery';
  return 'unknown';
}

/** Reads the `reason` the test route puts into its error params, if it is one we know. */
export function reasonFromResponse(body: unknown): TestFailureReason {
  if (typeof body !== 'object' || body === null) return 'unknown';
  const params = (body as { params?: unknown }).params;
  if (typeof params !== 'object' || params === null) return 'unknown';
  const reason = (params as { reason?: unknown }).reason;
  return KNOWN_REASONS.find((r) => r === reason) ?? 'unknown';
}

export interface AddressBookInfo {
  url: string;
  displayName: string | null;
  description?: string | null;
  contactCount: number | null;
}

export interface AddressBookSummary {
  bookCount: number;
  /** Sum over the books whose size the server told us. */
  contactCount: number;
  /** True when at least one book did not report its size. */
  countUnknown: boolean;
}

export function summarizeAddressBooks(books: readonly AddressBookInfo[] | undefined | null): AddressBookSummary {
  const list = books ?? [];
  let contactCount = 0;
  let countUnknown = false;
  for (const book of list) {
    if (typeof book.contactCount === 'number') contactCount += book.contactCount;
    else countUnknown = true;
  }
  return { bookCount: list.length, contactCount, countUnknown };
}

export function normalizeServerUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed && !/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}
