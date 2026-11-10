import { NextResponse } from 'next/server';
import { apiError, validationFailed } from '@/lib/api-errors';
import { createDAVClient } from 'tsdav';
import { validateServerUrl } from '@/lib/carddav/url-validation';
import { checkRateLimit } from '@/lib/rate-limit';
import { createModuleLogger } from '@/lib/logger';
import { withAuth } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { decryptPassword } from '@/lib/carddav/encryption';
import { classifyTestFailure } from '@/lib/carddav-ui/connection-test';
import { z } from 'zod';

const log = createModuleLogger('carddav');

const connectionTestSchema = z.object({
  serverUrl: z.string().url(),
  username: z.string().min(1),
  // Left out when the user edits an existing connection and keeps the saved password
  password: z.string().optional(),
});

function sameServer(a: string, b: string): boolean {
  const normalize = (url: string) => url.trim().replace(/\/+$/, '').toLowerCase();
  return normalize(a) === normalize(b);
}

// A host that accepts the connection but never answers would hold the request
// open until the platform gives up, so the whole test gets a deadline.
const TEST_TIMEOUT_MS = 30_000;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Connection test timed out')), ms);
  });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}

async function listAddressBooks(serverUrl: string, username: string, password: string) {
  const client = await createDAVClient({
    serverUrl,
    credentials: { username, password },
    authMethod: 'Basic',
    defaultAccountType: 'carddav',
  });

  const addressBooks = await client.fetchAddressBooks();

  // Per address book, a lightweight PROPFIND (depth 1) for etags and the
  // description gives the contact count and the description. tsdav's
  // fetchAddressBooks does not expose the description, so it is read from the
  // raw response.
  return Promise.all(
    addressBooks.map(async (ab) => {
      const absoluteUrl = /^https?:\/\//i.test(ab.url) ? ab.url : new URL(ab.url, serverUrl).href;
      let contactCount: number | null = null;
      let description: string | null = null;
      try {
        const resources = await client.propfind({
          url: absoluteUrl,
          props: {
            'd:getetag': {},
            'card:addressbook-description': {},
          },
          depth: '1',
        });
        // The first response is the collection itself, the rest are vCard resources
        contactCount = Math.max(0, resources.length - 1);
        const collectionProps = resources[0]?.props as Record<string, unknown> | undefined;
        const rawDesc = collectionProps?.addressbookDescription;
        if (typeof rawDesc === 'string' && rawDesc.trim()) {
          description = rawDesc.trim();
        }
      } catch (err) {
        log.warn({ err: err instanceof Error ? err : new Error(String(err)), url: absoluteUrl }, 'Failed to count contacts in address book');
      }
      return {
        url: absoluteUrl,
        displayName: typeof ab.displayName === 'string' ? ab.displayName : null,
        description,
        contactCount,
      };
    })
  );
}

// Dials whatever host the caller supplies, so it stays session-only: an API
// token must not be able to drive outbound requests to an arbitrary server.
export const POST = withAuth(async (request, session) => {
  try {
    const rateLimitResponse = checkRateLimit(request, 'carddavTest', session.user.id);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const validationResult = connectionTestSchema.safeParse(body);

    if (!validationResult.success) {
      return validationFailed(validationResult.error.issues, 'Invalid input', validationResult.error.issues);
    }

    const { serverUrl, username } = validationResult.data;
    let password = validationResult.data.password;

    // No password typed: test with the saved one, but only against the server
    // it was saved for, so the stored secret can never be sent somewhere else.
    if (!password) {
      const saved = await prisma.cardDavConnection.findUnique({
        where: { userId: session.user.id },
        select: { serverUrl: true, password: true },
      });
      if (!saved || !sameServer(saved.serverUrl, serverUrl)) {
        return apiError('password_required', 'Password is required to test this server');
      }
      password = decryptPassword(saved.password);
    }

    // Validate URL to prevent SSRF attacks
    try {
      await validateServerUrl(serverUrl);
    } catch (error) {
      return apiError('bad_request', error instanceof Error ? error.message : 'Invalid server URL');
    }

    try {
      const addressBooksWithCounts = await withTimeout(
        listAddressBooks(serverUrl, username, password),
        TEST_TIMEOUT_MS
      );

      return NextResponse.json({
        success: true,
        message: 'Connection successful',
        addressBooks: addressBooksWithCounts,
      });
    } catch (error) {
      log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'CardDAV connection test failed');

      // Provide more specific error messages. `reason` lets the page explain
      // what to do without parsing the English text.
      const reason = classifyTestFailure(error);
      if (reason === 'auth') {
        return apiError('carddav_auth_failed', 'Authentication failed. Please check your username and password.', { reason });
      }
      if (reason === 'not_found') {
        return apiError('carddav_unreachable', 'Server not found. Please check the server URL.', { reason });
      }
      if (reason === 'timeout') {
        return apiError('carddav_unreachable', 'Connection timeout. Please check the server URL and your network.', { reason });
      }

      return apiError('carddav_unreachable', 'Failed to connect to CardDAV server. Please check your settings.', { reason });
    }
  } catch (error) {
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Error testing CardDAV connection');
    return apiError('internal_error', 'Internal server error');
  }
}, { allowApiTokens: false });
