'use client';

import { useCallback, useState } from 'react';
import {
  failureKindFromResponse,
  normalizeServerUrl,
  summarizeAddressBooks,
  type AddressBookInfo,
  type AddressBookSummary,
  type TestFailureKind,
} from '@/lib/carddav-ui/connection-test';

export type ConnectionTestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'success'; books: AddressBookInfo[]; summary: AddressBookSummary }
  | { status: 'failure'; kind: TestFailureKind; serverMessage: string | null };

interface TestInput {
  serverUrl: string;
  username: string;
  /** Empty means "use the saved password" (only works for the saved server). */
  password: string;
}

/** Runs "Test connection" and keeps the outcome in a shape the page can explain. */
export function useConnectionTest(initial: ConnectionTestState = { status: 'idle' }) {
  const [state, setState] = useState<ConnectionTestState>(initial);

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  const run = useCallback(async (input: TestInput): Promise<AddressBookInfo[] | null> => {
    setState({ status: 'testing' });
    try {
      const response = await fetch('/api/carddav/connection/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverUrl: normalizeServerUrl(input.serverUrl),
          username: input.username,
          password: input.password || undefined,
        }),
      });
      const body: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string'
            ? (body as { error: string }).error
            : null;
        setState({ status: 'failure', kind: failureKindFromResponse(response.status, body), serverMessage: message });
        return null;
      }

      const rawBooks =
        typeof body === 'object' && body !== null ? (body as { addressBooks?: unknown }).addressBooks : undefined;
      const books = Array.isArray(rawBooks) ? (rawBooks as AddressBookInfo[]) : [];
      setState({ status: 'success', books, summary: summarizeAddressBooks(books) });
      return books;
    } catch {
      setState({ status: 'failure', kind: 'network', serverMessage: null });
      return null;
    }
  }, []);

  return { state, run, reset };
}
