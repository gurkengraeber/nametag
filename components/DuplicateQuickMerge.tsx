'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import MergeSummaryList from '@/components/MergeSummaryList';
import { useSearchIndex } from '@/components/SearchIndexProvider';
import {
  buildDefaultOverrides,
  compareScalarFields,
  formatFieldValue,
  formatPersonLabel,
  pickInitialPrimaryId,
  summarizeMerge,
  type PersonForCompare,
} from '@/lib/merge-compare';
import { fetchPersonForCompare, requestMerge } from '@/lib/merge-client';

interface DuplicateQuickMergeProps {
  personAId: string;
  personBId: string;
  isOpen: boolean;
  onClose: () => void;
  /** Called after a successful merge with the ids of the kept and removed contact. */
  onMerged: (primaryId: string, secondaryId: string) => void;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; personA: PersonForCompare; personB: PersonForCompare };

/**
 * One-step merge for the duplicates page: preselects the kept contact and the
 * newer value of every conflict, shows what will happen, and merges on one tap.
 * "Review every field" opens the full merge page instead.
 */
export default function DuplicateQuickMerge({
  personAId,
  personBId,
  isOpen,
  onClose,
  onMerged,
}: DuplicateQuickMergeProps) {
  const t = useTranslations('people.duplicates');
  const tMerge = useTranslations('people.merge');
  const { refreshIndex } = useSearchIndex();

  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoad({ status: 'loading' });
    setPrimaryId(null);
    setFailed(false);

    (async () => {
      try {
        const [personA, personB] = await Promise.all([
          fetchPersonForCompare(personAId),
          fetchPersonForCompare(personBId),
        ]);
        if (cancelled) return;
        if (!personA || !personB) {
          setLoad({ status: 'error' });
          return;
        }
        setLoad({ status: 'ready', personA, personB });
        setPrimaryId(pickInitialPrimaryId(personA, personB));
      } catch {
        if (!cancelled) setLoad({ status: 'error' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, personAId, personBId]);

  const plan = useMemo(() => {
    if (load.status !== 'ready' || primaryId === null) return null;
    const { personA, personB } = load;
    const primary = primaryId === personA.id ? personA : personB;
    const secondary = primaryId === personA.id ? personB : personA;
    const overrides = buildDefaultOverrides(primary, secondary);
    const conflicts = compareScalarFields(primary, secondary)
      .filter((f) => f.status === 'conflict')
      .map((f) => {
        const takesSecondary = f.key in overrides;
        return {
          key: f.key,
          labelKey: f.labelKey,
          value: f.key === 'photo' ? '' : formatFieldValue(takesSecondary ? f.valB : f.valA, f.key),
          from: takesSecondary ? secondary : primary,
        };
      });
    return {
      primary,
      secondary,
      overrides,
      conflicts,
      summary: summarizeMerge(primary, secondary, overrides),
    };
  }, [load, primaryId]);

  const handleMerge = async () => {
    if (!plan) return;
    setMerging(true);
    setFailed(false);
    const result = await requestMerge(plan.primary.id, plan.secondary.id, plan.overrides);
    setMerging(false);
    if (!result.ok) {
      setFailed(true);
      return;
    }
    toast.success(tMerge('success'));
    refreshIndex();
    onMerged(plan.primary.id, plan.secondary.id);
    onClose();
  };

  const reviewHref = `/people/merge?primary=${plan?.primary.id ?? personAId}&secondary=${plan?.secondary.id ?? personBId}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('quickMergeTitle')} size="lg">
      <div className="p-6 space-y-5">
        {load.status === 'loading' && (
          <div className="flex flex-col items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="mt-3 text-sm text-muted">{tMerge('loadingContacts')}</p>
          </div>
        )}

        {load.status === 'error' && (
          <p role="alert" className="text-sm text-warning">{tMerge('personNotFound')}</p>
        )}

        {plan && (
          <>
            <div className="rounded-lg border-2 border-primary bg-primary/5 p-3">
              <p className="text-xs font-medium text-primary">{tMerge('primary')}</p>
              <p className="font-semibold text-foreground break-words">
                {formatPersonLabel(plan.primary)}
              </p>
              <button
                type="button"
                onClick={() => setPrimaryId(plan.secondary.id)}
                className="mt-1 inline-flex items-center min-h-11 sm:min-h-0 text-sm text-primary hover:text-primary-dark underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
              >
                {t('quickMergeSwap', { name: formatPersonLabel(plan.secondary) })}
              </button>
            </div>

            {plan.conflicts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {t('quickMergeDifferences')}
                </h3>
                <dl className="mt-2 divide-y divide-border rounded-lg border border-border">
                  {plan.conflicts.map((c) => (
                    <div key={c.key} className="px-3 py-2 sm:flex sm:gap-4">
                      <dt className="text-xs font-medium text-muted sm:w-36 sm:flex-shrink-0">
                        {tMerge(c.labelKey)}
                      </dt>
                      <dd className="text-sm text-foreground break-words min-w-0">
                        {c.value || formatPersonLabel(c.from)}
                        {c.value && (
                          <span className="block text-xs text-muted">
                            {t('quickMergeFrom', { name: formatPersonLabel(c.from) })}
                          </span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">{tMerge('summary')}</h3>
              <MergeSummaryList
                primary={plan.primary}
                secondary={plan.secondary}
                summary={plan.summary}
              />
            </div>

            {failed && (
              <p role="alert" className="text-sm text-warning">{tMerge('error')}</p>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <Button variant="secondary" href={reviewHref}>
                {t('quickMergeReview')}
              </Button>
              <Button onClick={handleMerge} disabled={merging}>
                {merging ? tMerge('merging') : t('quickMergeConfirm')}
              </Button>
            </div>
          </>
        )}

        {load.status !== 'ready' && (
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              {tMerge('cancel')}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
