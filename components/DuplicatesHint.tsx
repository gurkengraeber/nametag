'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { countOpenSuggestions, type DuplicateGroupDisplay } from '@/lib/duplicate-view';

/**
 * Small link that tells the user how many duplicate suggestions are open.
 * Renders nothing while loading, on errors and when there is nothing to review,
 * so it can be dropped into any page without reserving space.
 */
export default function DuplicatesHint({ className = '' }: { className?: string }) {
  const t = useTranslations('people.duplicates');
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/people/duplicates');
        if (!res.ok) return;
        const data: { groups: DuplicateGroupDisplay[] } = await res.json();
        if (!cancelled) setCount(countOpenSuggestions(data.groups));
      } catch {
        // The hint is optional, stay silent.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (count === 0) return null;

  return (
    <Link
      href="/people/duplicates"
      className={`inline-flex items-center min-h-11 sm:min-h-0 text-sm text-primary hover:text-primary-dark underline ${className}`}
    >
      {t('hint', { count })}
    </Link>
  );
}
