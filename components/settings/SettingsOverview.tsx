'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { allSettingsItems } from './settingsCatalog';
import { groupSettings, type SearchableSetting } from './settingsSearch';

interface SettingsOverviewProps {
  isSaasMode: boolean;
}

/**
 * The settings start page: every area grouped by purpose with a one line
 * explanation, and a search box that filters across all of them. On a phone
 * this list replaces the sidebar, so each row is a full width touch target
 * with a chevron.
 */
export default function SettingsOverview({ isSaasMode }: SettingsOverviewProps) {
  const t = useTranslations();
  const [query, setQuery] = useState('');

  const entries: SearchableSetting[] = useMemo(
    () =>
      allSettingsItems
        .filter((item) => !item.saasOnly || isSaasMode)
        .map((item) => ({
          item,
          label: t(item.labelKey),
          description: t(item.descriptionKey),
          keywords: t(`settings.search.keywords.${item.id}`),
        })),
    [isSaasMode, t]
  );

  const groups = groupSettings(entries, query);

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="settings-search" className="sr-only">
          {t('settings.search.label')}
        </label>
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input
            id="settings-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('settings.search.placeholder')}
            autoComplete="off"
            className="w-full min-h-11 pl-10 pr-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="bg-surface shadow rounded-lg p-6 text-center" role="status">
          <p className="font-medium text-foreground">{t('settings.search.noResults', { query: query.trim() })}</p>
          <p className="text-sm text-muted mt-1">{t('settings.search.noResultsHint')}</p>
        </div>
      ) : (
        groups.map(({ group, entries: groupEntries }) => (
          <section key={group} aria-labelledby={`settings-group-${group}`}>
            <h2
              id={`settings-group-${group}`}
              className="text-sm font-semibold text-muted uppercase tracking-wide mb-2 px-1"
            >
              {t(`settings.groups.${group}`)}
            </h2>
            <ul className="bg-surface shadow rounded-lg overflow-hidden divide-y divide-border">
              {groupEntries.map(({ item, label, description }) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 px-4 py-3 min-h-14 text-muted hover:bg-surface-elevated/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                  >
                    <span className="flex-shrink-0 text-primary">{item.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-foreground">
                        {label}
                        {item.badgeKey && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                            {t(item.badgeKey)}
                          </span>
                        )}
                      </span>
                      <span className="block text-sm text-muted">{description}</span>
                    </span>
                    <svg
                      className="h-5 w-5 flex-shrink-0 text-muted"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
