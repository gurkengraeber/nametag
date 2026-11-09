/**
 * "Undo" toast for deleted people. Deleting a person only moves them to the
 * trash, so undoing is a restore call per person. Callers show the toast right
 * after a successful delete (see hooks/useUndoPersonDelete for the translated,
 * ready-to-use version).
 */

import { toast } from 'sonner';

export const UNDO_TOAST_DURATION_MS = 10000;

export interface RestoreResult {
  restored: string[];
  failed: string[];
}

/** Restore trashed people one by one; a failure does not stop the others. */
export async function restorePeople(ids: string[]): Promise<RestoreResult> {
  const result: RestoreResult = { restored: [], failed: [] };
  for (const id of ids) {
    try {
      const res = await fetch(`/api/people/${encodeURIComponent(id)}/restore`, { method: 'POST' });
      (res.ok ? result.restored : result.failed).push(id);
    } catch {
      result.failed.push(id);
    }
  }
  return result;
}

export interface UndoDeleteToastOptions {
  /** Ids of the people that were just deleted. */
  ids: string[];
  message: string;
  undoLabel: string;
  restoredMessage: string;
  failedMessage: string;
  /** Called after at least one person was restored, e.g. to refresh the page. */
  onRestored?: (restoredIds: string[]) => void;
  durationMs?: number;
}

/** Show "<message> [Undo]"; the button restores the people from the trash. */
export function showUndoDeleteToast(options: UndoDeleteToastOptions): void {
  const { ids, message, undoLabel, restoredMessage, failedMessage, onRestored, durationMs } = options;
  if (ids.length === 0) return;

  toast.success(message, {
    duration: durationMs ?? UNDO_TOAST_DURATION_MS,
    action: {
      label: undoLabel,
      onClick: async () => {
        const { restored, failed } = await restorePeople(ids);
        if (restored.length > 0) {
          toast.success(restoredMessage);
          onRestored?.(restored);
        }
        if (failed.length > 0) toast.error(failedMessage);
      },
    },
  });
}
