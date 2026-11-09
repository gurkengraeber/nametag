'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import BatchProgress from '@/components/carddav/BatchProgress';
import {
  compareVersions,
  parseVersion,
  planBulkResolution,
  recommendResolution,
  type BulkMode,
  type ConflictFieldKey,
  type FieldDiff,
  type RecommendationReason,
  type ResolutionChoice,
} from '@/lib/carddav-ui/conflict-diff';

interface Conflict {
  id: string;
  localVersion: string;
  remoteVersion: string;
  createdAt: Date;
  mapping: {
    person: {
      name?: string | null;
      surname?: string | null;
    };
  };
}

interface ConflictListProps {
  conflicts: Conflict[];
}

const DATE_FIELDS: ReadonlySet<ConflictFieldKey> = new Set(['birthday', 'anniversary']);

function formatValue(key: ConflictFieldKey, value: string): string {
  if (DATE_FIELDS.has(key) && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString();
  }
  return value;
}

const recommendationKey: Record<RecommendationReason, string> = {
  identical: 'recommendIdentical',
  serverAdds: 'recommendServerAdds',
  localAdds: 'recommendLocalAdds',
  differs: 'recommendDiffers',
};

export default function ConflictList({ conflicts }: ConflictListProps) {
  const t = useTranslations('settings.carddav.conflicts');
  const router = useRouter();
  const [resolving, setResolving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmMode, setConfirmMode] = useState<BulkMode | null>(null);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  const analysed = useMemo(
    () =>
      conflicts.map((conflict) => {
        const comparison = compareVersions(parseVersion(conflict.localVersion), parseVersion(conflict.remoteVersion));
        return { conflict, comparison, recommendation: recommendResolution(comparison) };
      }),
    [conflicts]
  );
  const safePlan = useMemo(() => planBulkResolution(conflicts, 'safe'), [conflicts]);

  const postResolution = async (conflictId: string, resolution: ResolutionChoice) => {
    const response = await fetch(`/api/carddav/conflicts/${conflictId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || t('resolveFailed'));
    }
  };

  const handleResolve = async (conflictId: string, resolution: ResolutionChoice) => {
    setResolving(conflictId);
    setError(null);
    setBulkMessage(null);
    try {
      await postResolution(conflictId, resolution);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('resolveFailed'));
    } finally {
      setResolving(null);
    }
  };

  const handleBulk = async (mode: BulkMode) => {
    setConfirmMode(null);
    setError(null);
    setBulkMessage(null);
    const plan = planBulkResolution(conflicts, mode);
    setBulk({ done: 0, total: plan.length });
    let failed = 0;
    let firstError: string | null = null;
    // One after the other: each resolution may push a change to the server.
    for (let i = 0; i < plan.length; i++) {
      try {
        await postResolution(plan[i].id, plan[i].resolution);
      } catch (err) {
        failed++;
        firstError = firstError ?? (err instanceof Error ? err.message : t('resolveFailed'));
      }
      setBulk({ done: i + 1, total: plan.length });
    }
    setBulk(null);
    setBulkMessage(
      failed === 0
        ? t('bulkDone', { count: plan.length })
        : t('bulkPartial', { done: plan.length - failed, failed })
    );
    if (firstError && failed > 0) setError(firstError);
    router.refresh();
  };

  const renderValues = (diff: FieldDiff, side: 'local' | 'remote') => {
    const values = side === 'local' ? diff.local : diff.remote;
    const unique = new Set(side === 'local' ? diff.onlyLocal : diff.onlyRemote);
    if (values.length === 0) return <span className="text-muted">{t('empty')}</span>;
    return (
      <ul className="space-y-1">
        {values.map((value, i) => {
          const differs = diff.kind === 'scalar' || unique.has(value);
          return (
            <li
              key={`${value}-${i}`}
              className={`break-words whitespace-pre-line ${differs ? 'font-medium text-foreground' : 'text-muted'}`}
            >
              {formatValue(diff.key, value)}
            </li>
          );
        })}
      </ul>
    );
  };

  const bulkBusy = bulk !== null;
  const confirmCount = confirmMode ? planBulkResolution(conflicts, confirmMode).length : 0;

  return (
    <div className="space-y-6">
      {/* Resolve many at once */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <p className="text-sm text-muted">{t('bulkIntro')}</p>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
          {safePlan.length > 0 && (
            <Button onClick={() => handleBulk('safe')} disabled={bulkBusy}>
              {t('applySafe', { count: safePlan.length })}
            </Button>
          )}
          <Button variant="secondary" onClick={() => setConfirmMode('keep_local')} disabled={bulkBusy}>
            {t('keepAllLocal')}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmMode('keep_remote')} disabled={bulkBusy}>
            {t('keepAllRemote')}
          </Button>
        </div>
        {safePlan.length > 0 && <p className="text-xs text-muted">{t('applySafeHelp')}</p>}
      </div>

      {bulk && (
        <BatchProgress
          done={bulk.done}
          total={bulk.total}
          label={t('resolving')}
          detail={t('bulkProgress', { done: bulk.done, total: bulk.total })}
        />
      )}

      {bulkMessage && (
        <div role="status" className="p-4 bg-primary/10 text-primary rounded-lg">
          {bulkMessage}
        </div>
      )}

      {error && (
        <div role="alert" className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg">
          {error}
        </div>
      )}

      {analysed.map(({ conflict, comparison, recommendation }) => {
        const isResolving = resolving === conflict.id;
        const disabled = isResolving || bulkBusy;
        const personName = [conflict.mapping.person.name, conflict.mapping.person.surname].filter(Boolean).join(' ');

        return (
          <div key={conflict.id} className="border border-border rounded-lg overflow-hidden">
            <div className="bg-surface-elevated px-4 sm:px-6 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground break-words">{personName}</h3>
              <p className="text-sm text-muted">
                {t('conflictDetected', { date: new Date(conflict.createdAt).toLocaleString() })}
              </p>
            </div>

            <div className="px-4 sm:px-6 py-4 space-y-4">
              <p className={`text-sm ${recommendation.safe ? 'text-foreground' : 'text-muted'}`}>
                {t(recommendationKey[recommendation.reason])}
              </p>

              {comparison.different.map((diff) => (
                <div key={diff.key} className="rounded-lg bg-amber-50 dark:bg-amber-900/10 p-3">
                  <p className="text-sm font-medium text-muted mb-2">{t(diff.key)}</p>
                  <div className="grid gap-3 sm:grid-cols-2 text-sm">
                    <div>
                      <p className="flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                        <span className="w-2.5 h-2.5 bg-blue-500 rounded-full" aria-hidden="true" />
                        {t('localVersion')}
                      </p>
                      {renderValues(diff, 'local')}
                    </div>
                    <div>
                      <p className="flex items-center gap-2 text-xs font-medium text-green-700 dark:text-green-300 mb-1">
                        <span className="w-2.5 h-2.5 bg-green-500 rounded-full" aria-hidden="true" />
                        {t('remoteVersion')}
                      </p>
                      {renderValues(diff, 'remote')}
                    </div>
                  </div>
                </div>
              ))}

              {comparison.sameKeys.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted min-h-11 sm:min-h-0 flex items-center">
                    {t('unchangedFields', { count: comparison.sameKeys.length })}
                  </summary>
                  <p className="mt-1 text-muted">{comparison.sameKeys.map((key) => t(key)).join(', ')}</p>
                </details>
              )}
            </div>

            {/* Action Buttons */}
            <div className="bg-surface-elevated px-4 sm:px-6 py-4 border-t border-border space-y-4">
              <p className="text-sm text-muted">{t('chooseVersion')}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Button onClick={() => handleResolve(conflict.id, 'keep_local')} disabled={disabled} fullWidth>
                    {isResolving ? t('resolving') : t('keepLocal')}
                    {recommendation.choice === 'keep_local' && ` (${t('recommended')})`}
                  </Button>
                  <p className="text-xs text-muted">{t('keepLocalHelp')}</p>
                </div>
                <div className="space-y-2">
                  <Button
                    onClick={() => handleResolve(conflict.id, 'keep_remote')}
                    disabled={disabled}
                    fullWidth
                    variant={recommendation.choice === 'keep_remote' ? 'primary' : 'secondary'}
                  >
                    {isResolving ? t('resolving') : t('keepRemote')}
                    {recommendation.choice === 'keep_remote' && ` (${t('recommended')})`}
                  </Button>
                  <p className="text-xs text-muted">{t('keepRemoteHelp')}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <ConfirmationModal
        isOpen={confirmMode !== null}
        onClose={() => setConfirmMode(null)}
        onConfirm={() => confirmMode && handleBulk(confirmMode)}
        title={confirmMode === 'keep_local' ? t('confirmAllLocalTitle') : t('confirmAllRemoteTitle')}
        confirmText={t('confirmAll', { count: confirmCount })}
        cancelText={t('cancel')}
        variant="warning"
      >
        <p className="text-muted">
          {confirmMode === 'keep_local'
            ? t('confirmAllLocalBody', { count: confirmCount })
            : t('confirmAllRemoteBody', { count: confirmCount })}
        </p>
      </ConfirmationModal>
    </div>
  );
}
