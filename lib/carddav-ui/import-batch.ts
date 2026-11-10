/**
 * Builds the requests for the import and export pages. Both endpoints take a
 * list of ids, so a long selection is sent in several smaller requests and the
 * page shows progress between them.
 */

export const IMPORT_BATCH_SIZE = 25;
export const EXPORT_BATCH_SIZE = 25;

/** A failed batch whose message is meant for the person, unlike a browser's "Failed to fetch". */
export class BatchRequestError extends Error {}

/** The text to show for a failed batch: our own message, or the fallback for anything else. */
export function batchErrorMessage(error: unknown, fallback: string): string {
  return error instanceof BatchRequestError ? error.message : fallback;
}

export interface ImportOptions {
  globalGroupIds: string[];
  globalRelationshipTypeId: string;
  perContactGroups: ReadonlyMap<string, string[]>;
  perContactRelationshipTypeId: ReadonlyMap<string, string>;
  updateExistingIds: ReadonlySet<string>;
}

export interface ImportRequestBody {
  importIds: string[];
  globalGroupIds: string[];
  perContactGroups: Record<string, string[]>;
  globalRelationshipTypeId: string | null;
  perContactRelationshipTypeId: Record<string, string>;
  updateExistingIds: string[];
}

/** The request body for one batch: per contact settings are cut down to the ids in it. */
export function buildImportBody(batchIds: readonly string[], options: ImportOptions): ImportRequestBody {
  const ids = new Set(batchIds);
  const perContactGroups: Record<string, string[]> = {};
  options.perContactGroups.forEach((groupIds, id) => {
    if (ids.has(id) && groupIds.length > 0) perContactGroups[id] = groupIds;
  });
  const perContactRelationshipTypeId: Record<string, string> = {};
  options.perContactRelationshipTypeId.forEach((relId, id) => {
    if (ids.has(id) && relId) perContactRelationshipTypeId[id] = relId;
  });
  return {
    importIds: [...batchIds],
    globalGroupIds: options.globalGroupIds,
    perContactGroups,
    globalRelationshipTypeId: options.globalRelationshipTypeId || null,
    perContactRelationshipTypeId,
    updateExistingIds: batchIds.filter((id) => options.updateExistingIds.has(id)),
  };
}

export interface ImportTotals {
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  errorMessages: string[];
}

export function emptyImportTotals(): ImportTotals {
  return { imported: 0, updated: 0, skipped: 0, errors: 0, errorMessages: [] };
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Add one response of /api/carddav/import (or export-bulk) to the running totals. */
export function addImportResult(totals: ImportTotals, response: unknown): ImportTotals {
  const data = (typeof response === 'object' && response !== null ? response : {}) as Record<string, unknown>;
  const messages = Array.isArray(data.errorMessages)
    ? data.errorMessages.filter((m): m is string => typeof m === 'string')
    : [];
  return {
    imported: totals.imported + num(data.imported),
    updated: totals.updated + num(data.updated),
    skipped: totals.skipped + num(data.skipped),
    errors: totals.errors + num(data.errors),
    errorMessages: [...totals.errorMessages, ...messages],
  };
}

export interface ExportTotals {
  exported: number;
  skipped: number;
  errors: number;
  errorMessages: string[];
}

export function emptyExportTotals(): ExportTotals {
  return { exported: 0, skipped: 0, errors: 0, errorMessages: [] };
}

export function addExportResult(totals: ExportTotals, response: unknown): ExportTotals {
  const data = (typeof response === 'object' && response !== null ? response : {}) as Record<string, unknown>;
  const messages = Array.isArray(data.errorMessages)
    ? data.errorMessages.filter((m): m is string => typeof m === 'string')
    : [];
  return {
    exported: totals.exported + num(data.exported),
    skipped: totals.skipped + num(data.skipped),
    errors: totals.errors + num(data.errors),
    errorMessages: [...totals.errorMessages, ...messages],
  };
}
