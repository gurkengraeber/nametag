'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from './ui/Button';
import EmptyState from './EmptyState';
import { PRESET_COLORS } from '@/lib/colors';
import { pickFreshColor } from '@/lib/color-choice';
import { findSimilarName } from '@/lib/name-similarity';
import {
  GROUP_SORTS,
  parseGroupSort,
  visibleGroups,
  type GroupSort,
  type OverviewGroup,
} from '@/lib/group-overview';

export interface GroupOverviewItem extends OverviewGroup {
  /** Display names of the first few members. */
  preview: string[];
}

interface GroupsOverviewProps {
  groups: GroupOverviewItem[];
  canCreate: boolean;
  limit?: number;
}

const SUGGESTION_KEYS = ['family', 'friends', 'work', 'neighbors'] as const;

export default function GroupsOverview({ groups, canCreate, limit }: GroupsOverviewProps) {
  const t = useTranslations('groups');
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<GroupSort>('name');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(() => pickFreshColor(groups.map((g) => g.color)));
  const [isCreating, setIsCreating] = useState(false);

  const shown = useMemo(() => visibleGroups(groups, query, sort), [groups, query, sort]);
  const similar = useMemo(
    () => findSimilarName(newName, groups, (g) => g.name),
    [newName, groups]
  );

  const createGroup = async (name: string, color: string): Promise<boolean> => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || t('quickAdd.error'));
        return false;
      }
      toast.success(t('quickAdd.created', { name }));
      router.refresh();
      return true;
    } catch {
      toast.error(t('quickAdd.errorConnection'));
      return false;
    } finally {
      setIsCreating(false);
    }
  };

  const handleQuickAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || isCreating) return;
    const color = newColor;
    if (await createGroup(name, color)) {
      setNewName('');
      setNewColor(pickFreshColor([...groups.map((g) => g.color), color]));
    }
  };

  const handleSuggestion = async (name: string) => {
    if (isCreating) return;
    await createGroup(name, pickFreshColor(groups.map((g) => g.color)));
  };

  const cycleColor = () => {
    const index = PRESET_COLORS.findIndex((c) => c.toLowerCase() === newColor.toLowerCase());
    setNewColor(PRESET_COLORS[(index + 1) % PRESET_COLORS.length]);
  };

  const quickAdd = canCreate ? (
    <form onSubmit={handleQuickAdd} className="mb-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={cycleColor}
          className="flex-shrink-0 w-11 h-11 sm:w-10 sm:h-10 rounded-lg border border-border bg-surface flex items-center justify-center hover:bg-surface-elevated"
          aria-label={t('quickAdd.changeColor')}
          title={t('quickAdd.changeColor')}
        >
          <span className="block w-6 h-6 rounded-full" style={{ backgroundColor: newColor }} />
        </button>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={50}
          autoComplete="off"
          enterKeyHint="done"
          aria-label={t('quickAdd.label')}
          placeholder={t('quickAdd.placeholder')}
          className="flex-1 min-w-0 px-3 py-2 min-h-11 sm:min-h-0 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <Button type="submit" disabled={isCreating || newName.trim() === ''}>
          {isCreating ? t('quickAdd.adding') : t('quickAdd.add')}
        </Button>
      </div>
      {similar && (
        <p role="status" className="text-xs text-warning mt-1">
          {similar.exact
            ? t('quickAdd.nameExists', { name: similar.item.name })
            : t('quickAdd.nameSimilar', { name: similar.item.name })}
        </p>
      )}
    </form>
  ) : (
    <p className="mb-4 text-sm text-muted">
      {t('limitReached', { limit: limit ?? 0 })}{' '}
      <Link href="/settings/billing" className="text-primary hover:text-primary-dark underline">
        {t('upgradePlan')}
      </Link>
    </p>
  );

  if (groups.length === 0) {
    return (
      <>
      {quickAdd}
      <div className="bg-surface shadow rounded-lg">
        <EmptyState
          icon={
            <svg className="w-12 h-12 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
          title={t('noGroupsYet')}
          description={t('noGroupsDescription')}
          actionLabel={t('createFirstGroup')}
          actionHref="/groups/new"
        />
        {canCreate && (
          <div className="px-6 pb-8 text-center">
            <p className="text-sm text-muted mb-3">{t('suggestions.intro')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTION_KEYS.map((key) => (
                <Button
                  key={key}
                  variant="secondary"
                  onClick={() => handleSuggestion(t(`suggestions.${key}`))}
                  disabled={isCreating}
                >
                  {t(`suggestions.${key}`)}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
      </>
    );
  }

  return (
    <>
      {quickAdd}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t('searchGroups')}
          placeholder={t('searchGroups')}
          className="flex-1 min-w-0 px-3 py-2 min-h-11 sm:min-h-0 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <select
          value={sort}
          onChange={(e) => setSort(parseGroupSort(e.target.value))}
          aria-label={t('sort.label')}
          className="px-3 py-2 min-h-11 sm:min-h-0 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {GROUP_SORTS.map((option) => (
            <option key={option} value={option}>
              {t(`sort.${option}`)}
            </option>
          ))}
        </select>
      </div>

      {shown.length === 0 ? (
        <div className="bg-surface shadow-sm rounded-lg p-6 text-center">
          <p className="text-sm text-muted mb-3">{t('noSearchResults', { query: query.trim() })}</p>
          <Button variant="secondary" onClick={() => setQuery('')}>
            {t('clearSearch')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {shown.map((group) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              className="bg-surface shadow-sm rounded-lg p-4 sm:p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 min-w-0"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-foreground mb-1 break-words">
                    {group.name}
                  </h3>
                  {group.description && (
                    <p className="text-sm text-muted">{group.description}</p>
                  )}
                </div>
                {group.color && (
                  <div
                    className="w-6 h-6 rounded-full ml-3 flex-shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted">
                  {group.memberCount === 0 && t('noMembersYet')}
                  {group.memberCount === 1 && t('oneMember')}
                  {group.memberCount > 1 && t('membersCount', { count: group.memberCount })}
                </p>
                {group.preview.length > 0 && (
                  <p className="text-xs text-muted mt-1 truncate">
                    {group.preview.join(', ')}
                    {group.memberCount > group.preview.length &&
                      ` ${t('morePeople', { count: group.memberCount - group.preview.length })}`}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
