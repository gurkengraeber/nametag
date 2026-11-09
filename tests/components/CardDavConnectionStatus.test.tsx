import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConnectionStatus from '@/components/carddav/ConnectionStatus';
import type { CardDavConnectionResponse } from '@/lib/carddav/types';

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));

const connection: CardDavConnectionResponse = {
  id: 'c1',
  userId: 'u1',
  serverUrl: 'https://dav.example.com/',
  username: 'ada@example.com',
  provider: 'mailbox',
  syncEnabled: true,
  autoSyncInterval: 43200,
  lastSyncAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  syncToken: null,
  autoExportNew: true,
  importMode: 'manual',
  cardDavNameFormat: 'FULL',
  lastError: null,
  lastErrorAt: null,
  syncInProgress: false,
  syncStartedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function renderStatus(overrides: Partial<{ conn: CardDavConnectionResponse; imports: number; conflicts: number; uploads: number }> = {}) {
  return render(
    <ConnectionStatus
      connection={overrides.conn ?? connection}
      pendingImportsCount={overrides.imports ?? 0}
      syncedContactsCount={10}
      pendingUploadsCount={overrides.uploads ?? 0}
      conflictsCount={overrides.conflicts ?? 0}
      onConnectClick={vi.fn()}
      onEditClick={vi.fn()}
      onSettingsClick={vi.fn()}
      onSyncClick={vi.fn()}
    />
  );
}

describe('ConnectionStatus', () => {
  it('shows the last sync as relative time', () => {
    renderStatus();
    expect(screen.getByText('5 minutes ago')).toBeDefined();
  });

  it('links to waiting imports and conflicts with their counts', () => {
    renderStatus({ imports: 3, conflicts: 2 });
    const imports = screen.getByRole('link', { name: /pendingImportsLink/ });
    expect(imports.getAttribute('href')).toBe('/carddav/import');
    expect(imports.textContent).toContain('"count":3');
    const conflicts = screen.getByRole('link', { name: /conflictsLink/ });
    expect(conflicts.getAttribute('href')).toBe('/carddav/conflicts');
    expect(conflicts.textContent).toContain('"count":2');
  });

  it('says everything is up to date when nothing waits', () => {
    renderStatus();
    expect(screen.getByText('allUpToDate')).toBeDefined();
  });

  it('does not claim it is up to date while something waits', () => {
    renderStatus({ conflicts: 1 });
    expect(screen.queryByText('allUpToDate')).toBeNull();
  });

  it('warns when automatic sync is off', () => {
    renderStatus({ conn: { ...connection, syncEnabled: false } });
    expect(screen.getByText('autoSyncOff')).toBeDefined();
  });

  it('links to the bulk export page', () => {
    renderStatus();
    expect(screen.getByRole('link', { name: 'exportLink' }).getAttribute('href')).toBe('/carddav/export');
  });
});
