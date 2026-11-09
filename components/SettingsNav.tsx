'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { allSettingsItems, SETTINGS_GROUP_ORDER } from './settings/settingsCatalog';
import { isSettingsOverviewPath } from './settings/settingsSearch';

export default function SettingsNav({ isSaasMode }: { isSaasMode: boolean }) {
  const pathname = usePathname();
  const t = useTranslations();

  // Filter out SaaS-only items when not in SaaS mode
  const settingsNavItems = allSettingsItems.filter(
    (item) => !item.saasOnly || isSaasMode
  );

  const onOverview = isSettingsOverviewPath(pathname);

  return (
    <div>
      {/*
        Mobile: the overview page is itself the list of areas, so nothing is
        shown above it. Inside an area, a single back link returns to that list.
      */}
      {!onOverview && (
        <Link
          href="/settings"
          className="md:hidden inline-flex items-center gap-1 min-h-11 -ml-1 px-1 text-sm font-medium text-primary hover:underline"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('settings.backToOverview')}
        </Link>
      )}

      {/* Desktop: Sidebar navigation, grouped */}
      <nav
        aria-label={t('settings.menu')}
        className="hidden md:block bg-surface shadow rounded-lg overflow-hidden"
      >
        <Link
          href="/settings"
          aria-current={onOverview ? 'page' : undefined}
          className={`flex items-center gap-3 px-4 py-3 transition-colors border-l-4 ${
            onOverview
              ? 'bg-primary/10 text-primary border-primary'
              : 'text-muted hover:bg-surface-elevated/50 border-transparent'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="font-medium">{t('settings.overviewTitle')}</span>
        </Link>
        {SETTINGS_GROUP_ORDER.map((group) => {
          const groupItems = settingsNavItems.filter((item) => item.group === group);
          if (groupItems.length === 0) return null;

          return (
            <div key={group} className="border-t border-border">
              <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                {t(`settings.groups.${group}`)}
              </p>
              <ul>
                {groupItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                          isActive
                            ? 'bg-primary/10 text-primary border-l-4 border-primary'
                            : 'text-muted hover:bg-surface-elevated/50 border-l-4 border-transparent'
                        }`}
                      >
                        <span className={isActive ? 'text-primary' : 'text-muted'}>
                          {item.icon}
                        </span>
                        <div className="min-w-0">
                          <p className={`font-medium ${isActive ? 'text-primary' : ''}`}>
                            {t(item.labelKey)}
                            {item.badgeKey && (
                              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                {t(item.badgeKey)}
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-muted truncate">
                            {t(item.descriptionKey)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
