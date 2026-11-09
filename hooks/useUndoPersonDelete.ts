'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchIndex } from '@/components/SearchIndexProvider';
import { showUndoDeleteToast } from '@/lib/undo-delete';

export interface PersonDeletedNotice {
  ids: string[];
  /** Display name, used when exactly one person was deleted. */
  name?: string;
  /** Runs after people were restored, e.g. `router.refresh()`. */
  onRestored?: () => void;
}

/**
 * Returns a function to call after people were deleted. It shows a toast with an
 * "Undo" button that restores them from the trash and refreshes the search index.
 */
export function useUndoPersonDelete(): (notice: PersonDeletedNotice) => void {
  const t = useTranslations('people.undoDelete');
  const { refreshIndex } = useSearchIndex();

  return useCallback(
    ({ ids, name, onRestored }: PersonDeletedNotice) => {
      const single = ids.length === 1 && name;
      showUndoDeleteToast({
        ids,
        message: single ? t('deleted', { name }) : t('deletedMany', { count: ids.length }),
        undoLabel: t('undo'),
        restoredMessage: t('restored', { count: ids.length }),
        failedMessage: t('restoreFailed'),
        onRestored: () => {
          refreshIndex();
          onRestored?.();
        },
      });
    },
    [t, refreshIndex]
  );
}
