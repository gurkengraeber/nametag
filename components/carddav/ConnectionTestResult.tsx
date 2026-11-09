'use client';

import { useTranslations } from 'next-intl';
import type { ConnectionTestState } from './useConnectionTest';

interface ConnectionTestResultProps {
  state: ConnectionTestState;
}

const successBox =
  'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800';
const warningBox =
  'bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-100 border border-amber-200 dark:border-amber-800';
const errorBox =
  'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800';

/**
 * The outcome of "Test connection" in plain words: how many contacts were
 * found, or what is wrong and what to do about it.
 */
export default function ConnectionTestResult({ state }: ConnectionTestResultProps) {
  const t = useTranslations('settings.carddav');

  if (state.status === 'idle' || state.status === 'testing') return null;

  if (state.status === 'failure') {
    return (
      <div role="alert" className={`p-4 rounded-lg ${errorBox}`}>
        <p className="font-medium">{t('testFailedTitle')}</p>
        <p className="text-sm mt-1">{t(`testReason_${state.kind}`)}</p>
        {state.kind === 'invalid_input' && state.serverMessage && (
          <p className="text-sm mt-1 break-words">{state.serverMessage}</p>
        )}
      </div>
    );
  }

  const { summary, books } = state;
  const isEmpty = summary.contactCount === 0 && !summary.countUnknown;

  return (
    <div role="status" className={`p-4 rounded-lg ${isEmpty ? warningBox : successBox}`}>
      <p className="font-medium">
        {summary.countUnknown && summary.contactCount === 0
          ? t('testSuccessUnknownCount')
          : t('testSuccessCount', { count: summary.contactCount, books: summary.bookCount })}
      </p>
      {isEmpty && <p className="text-sm mt-1">{t('testZeroContacts')}</p>}
      {summary.bookCount > 1 && (
        <ul className="mt-2 space-y-1 text-sm">
          {books.map((book) => (
            <li key={book.url} className="break-words">
              {book.displayName || t('wizard.addressBookNoName')}
              {': '}
              {typeof book.contactCount === 'number'
                ? t('wizard.contactCount', { count: book.contactCount })
                : t('testCountUnknown')}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
