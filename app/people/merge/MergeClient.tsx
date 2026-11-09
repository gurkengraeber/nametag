'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import PersonCompare from '@/components/PersonCompare';
import { useSearchIndex } from '@/components/SearchIndexProvider';
import type { MergeSelections, PersonForCompare } from '@/lib/merge-compare';
import { fetchPersonForCompare, requestMerge } from '@/lib/merge-client';

function MergePageContent() {
  const t = useTranslations('people.merge');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshIndex } = useSearchIndex();

  const primaryParam = searchParams.get('primary');
  const secondaryParam = searchParams.get('secondary');

  const [personA, setPersonA] = useState<PersonForCompare | null>(null);
  const [personB, setPersonB] = useState<PersonForCompare | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [selections, setSelections] = useState<MergeSelections | null>(null);

  useEffect(() => {
    if (!primaryParam || !secondaryParam) {
      setLoading(false);
      setError(t('missingParams'));
      return;
    }

    async function fetchPeople() {
      try {
        const [loadedA, loadedB] = await Promise.all([
          fetchPersonForCompare(primaryParam as string),
          fetchPersonForCompare(secondaryParam as string),
        ]);

        if (!loadedA || !loadedB) {
          setError(t('personNotFound'));
          setLoading(false);
          return;
        }

        setPersonA(loadedA);
        setPersonB(loadedB);
      } catch {
        setError(t('error'));
      } finally {
        setLoading(false);
      }
    }

    fetchPeople();
  }, [primaryParam, secondaryParam, t]);

  const handleSelectionsChange = useCallback(
    (newSelections: MergeSelections) => {
      setSelections(newSelections);
    },
    []
  );

  const handleMerge = async () => {
    if (!selections || !personA || !personB) return;

    setMerging(true);
    const secondaryId = selections.primaryId === personA.id ? personB.id : personA.id;
    const result = await requestMerge(selections.primaryId, secondaryId, selections.fieldOverrides);
    setMerging(false);

    if (!result.ok) {
      toast.error(result.error ?? t('error'));
      return;
    }

    toast.success(t('success'));
    refreshIndex();
    router.push(`/people/${selections.primaryId}`);
  };

  return (
    <main className="max-w-5xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-3xl font-bold text-foreground mb-6">
          {t('title')}
        </h1>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <p className="mt-4 text-muted">{t('loadingContacts')}</p>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-400 dark:border-red-800 rounded-lg p-6">
            <p className="text-red-600 dark:text-red-300">{error}</p>
            <Link
              href="/people"
              className="mt-4 inline-block text-primary hover:text-primary-dark underline"
            >
              {tCommon('back')}
            </Link>
          </div>
        )}

        {!loading && !error && personA && personB && (
          <>
            <PersonCompare
              personA={personA}
              personB={personB}
              onSelectionsChange={handleSelectionsChange}
            />

            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <Button href="/people" variant="secondary">
                {t('cancel')}
              </Button>
              <Button onClick={handleMerge} disabled={merging || !selections}>
                {merging ? t('merging') : t('confirmMerge')}
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function LoadingFallback() {
  const t = useTranslations('people.merge');
  return (
    <main className="max-w-5xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted">{t('loadingContacts')}</p>
        </div>
      </div>
    </main>
  );
}

export default function MergeClient() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <MergePageContent />
    </Suspense>
  );
}
