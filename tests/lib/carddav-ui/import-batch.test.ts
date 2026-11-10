import { describe, it, expect } from 'vitest';
import {
  BatchRequestError,
  batchErrorMessage,
  buildImportBody,
  addImportResult,
  emptyImportTotals,
  addExportResult,
  emptyExportTotals,
  type ImportOptions,
} from '@/lib/carddav-ui/import-batch';

const options: ImportOptions = {
  globalGroupIds: ['g1'],
  globalRelationshipTypeId: 'rel-1',
  perContactGroups: new Map([
    ['a', ['g2']],
    ['b', ['g3']],
    ['c', []],
  ]),
  perContactRelationshipTypeId: new Map([
    ['a', '__none__'],
    ['b', 'rel-2'],
  ]),
  updateExistingIds: new Set(['a', 'z']),
};

describe('buildImportBody', () => {
  it('keeps only per contact settings for ids in the batch', () => {
    const body = buildImportBody(['a', 'c'], options);
    expect(body.importIds).toEqual(['a', 'c']);
    expect(body.perContactGroups).toEqual({ a: ['g2'] });
    expect(body.perContactRelationshipTypeId).toEqual({ a: '__none__' });
  });

  it('passes the global settings to every batch', () => {
    const body = buildImportBody(['b'], options);
    expect(body.globalGroupIds).toEqual(['g1']);
    expect(body.globalRelationshipTypeId).toBe('rel-1');
  });

  it('sends null when no global relationship is chosen', () => {
    const body = buildImportBody(['a'], { ...options, globalRelationshipTypeId: '' });
    expect(body.globalRelationshipTypeId).toBeNull();
  });

  it('limits updateExistingIds to the batch', () => {
    expect(buildImportBody(['a', 'b'], options).updateExistingIds).toEqual(['a']);
    expect(buildImportBody(['b'], options).updateExistingIds).toEqual([]);
  });
});

describe('addImportResult', () => {
  it('adds numbers and collects error messages', () => {
    let totals = emptyImportTotals();
    totals = addImportResult(totals, { imported: 3, updated: 1, skipped: 2, errors: 1, errorMessages: ['Failed to import Ada'] });
    totals = addImportResult(totals, { imported: 2, errors: 0, errorMessages: [] });
    expect(totals).toEqual({
      imported: 5,
      updated: 1,
      skipped: 2,
      errors: 1,
      errorMessages: ['Failed to import Ada'],
    });
  });

  it('ignores malformed responses', () => {
    expect(addImportResult(emptyImportTotals(), null)).toEqual(emptyImportTotals());
    expect(addImportResult(emptyImportTotals(), { imported: 'x', errorMessages: [1, 'ok'] }).errorMessages).toEqual(['ok']);
  });
});

describe('addExportResult', () => {
  it('adds export numbers', () => {
    const totals = addExportResult(
      addExportResult(emptyExportTotals(), { exported: 4, skipped: 1, errors: 0, errorMessages: [] }),
      { exported: 2, skipped: 0, errors: 1, errorMessages: ['Failed to export Grace'] },
    );
    expect(totals).toEqual({ exported: 6, skipped: 1, errors: 1, errorMessages: ['Failed to export Grace'] });
  });
});

describe('batchErrorMessage', () => {
  it('shows our own messages and hides the browser wording', () => {
    expect(batchErrorMessage(new BatchRequestError('Plan limit reached'), 'Failed')).toBe('Plan limit reached');
    expect(batchErrorMessage(new TypeError('Failed to fetch'), 'Import failed')).toBe('Import failed');
    expect(batchErrorMessage('boom', 'Import failed')).toBe('Import failed');
  });
});
