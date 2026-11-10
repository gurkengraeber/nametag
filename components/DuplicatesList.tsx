'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import DuplicateQuickMerge from '@/components/DuplicateQuickMerge';
import type { DuplicateConfidence } from '@/lib/duplicate-detection';
import {
  buildSuggestions,
  filterSuggestions,
  formatList,
  groupByConfidence,
  type DuplicateGroupDisplay,
  type DuplicateSuggestion,
} from '@/lib/duplicate-view';

export type { DuplicateGroupDisplay };

export interface DuplicateCandidateDisplay {
  personId: string;
  name: string;
  surname: string | null;
  similarity: number;
}

interface DuplicatesListProps {
  groups: DuplicateGroupDisplay[];
}

function formatName(name: string, surname: string | null): string {
  return [name, surname].filter(Boolean).join(' ');
}

function SimilarityBadge({ score }: { score: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary whitespace-nowrap">
      {score}
    </span>
  );
}

async function sendDismissal(
  method: 'POST' | 'DELETE',
  personAId: string,
  personBId: string
): Promise<boolean> {
  try {
    const res = await fetch('/api/people/duplicates/dismiss', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personAId, personBId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const dismissPair = (a: string, b: string) => sendDismissal('POST', a, b);
const undoDismissPair = (a: string, b: string) => sendDismissal('DELETE', a, b);

function EmptyDuplicates({ title, description }: { title: string; description: string }) {
  return (
    <div className="text-center py-12">
      <svg className="mx-auto h-12 w-12 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h3 className="mt-4 text-lg font-medium text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted max-w-md mx-auto">{description}</p>
    </div>
  );
}

export default function DuplicatesList({ groups }: DuplicatesListProps) {
  const t = useTranslations('people.duplicates');
  const locale = useLocale();

  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [mergeTarget, setMergeTarget] = useState<DuplicateSuggestion | null>(null);

  const suggestions = useMemo(() => buildSuggestions(groups), [groups]);

  const handleDismiss = async (suggestion: DuplicateSuggestion) => {
    const { key, a, b } = suggestion;
    setBusyKeys((prev) => new Set(prev).add(key));
    const ok = await dismissPair(a.id, b.id);
    setBusyKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    if (!ok) {
      toast.error(t('dismissError'));
      return;
    }

    setDismissedKeys((prev) => new Set(prev).add(key));
    toast.success(t('dismissed'), {
      action: {
        label: t('undo'),
        onClick: async () => {
          const restored = await undoDismissPair(a.id, b.id);
          if (restored) {
            setDismissedKeys((prev) => {
              const next = new Set(prev);
              next.delete(key);
              return next;
            });
          } else {
            toast.error(t('undoError'));
          }
        },
      },
    });
  };

  const visible = filterSuggestions(suggestions, dismissedKeys, removedIds);
  const sections = groupByConfidence(visible);

  if (visible.length === 0) {
    return (
      <EmptyDuplicates
        title={t('noDuplicates')}
        description={t('noDuplicatesDescription')}
      />
    );
  }

  const sectionTitle: Record<DuplicateConfidence, string> = {
    high: t('confidenceHigh'),
    medium: t('confidenceMedium'),
    low: t('confidenceLow'),
  };

  const reasonLabel = (reason: DuplicateSuggestion['reasons'][number]) => t(`reason.${reason}`);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted" aria-live="polite">
        {t('openSuggestions', { count: visible.length })}
      </p>

      {sections.map(({ confidence, items }) => (
        <section key={confidence} aria-label={sectionTitle[confidence]} className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            {sectionTitle[confidence]}
            <span className="ml-2 text-muted font-normal">{items.length}</span>
          </h2>

          {items.map((suggestion) => {
            const { key, a, b, similarity, reasons } = suggestion;
            const nameA = formatName(a.name, a.surname);
            const nameB = formatName(b.name, b.surname);
            return (
              <div
                key={key}
                className="bg-surface border border-border rounded-lg p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                  <p className="font-semibold text-foreground break-words min-w-0">
                    {nameA} <span className="text-muted font-normal">&amp;</span> {nameB}
                  </p>
                  <SimilarityBadge score={t('similarity', { score: Math.round(similarity * 100) })} />
                </div>

                {reasons.length > 0 && (
                  <p className="text-sm text-muted">
                    {t('reasonLine', { reasons: formatList(reasons.map(reasonLabel), locale) })}
                  </p>
                )}

                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                  <Button size="sm" onClick={() => setMergeTarget(suggestion)}>
                    {t('quickMerge')}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    href={`/people/merge?primary=${a.id}&secondary=${b.id}`}
                  >
                    {t('review')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDismiss(suggestion)}
                    disabled={busyKeys.has(key)}
                  >
                    {t('notDuplicate')}
                  </Button>
                </div>
              </div>
            );
          })}
        </section>
      ))}

      {mergeTarget && (
        <DuplicateQuickMerge
          isOpen
          personAId={mergeTarget.a.id}
          personBId={mergeTarget.b.id}
          onClose={() => setMergeTarget(null)}
          onMerged={(_primaryId, secondaryId) =>
            setRemovedIds((prev) => new Set(prev).add(secondaryId))
          }
        />
      )}
    </div>
  );
}
