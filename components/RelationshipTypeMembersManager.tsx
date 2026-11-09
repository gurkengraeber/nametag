'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import PillSelector from './PillSelector';
import PersonAvatar from './PersonPhoto';
import { Button } from './ui/Button';
import { formatFullName, formatGraphName, type NameDisplayFormat } from '@/lib/nameUtils';
import { formatDate, parseCalendarDate, type DateFormat } from '@/lib/date-format';
import {
  filterByLabel,
  selectionState,
  setAllSelected,
  toggleSelected,
} from '@/lib/people-selection';

interface PersonGroupChip {
  id: string;
  name: string;
  color: string | null;
}

export interface TypePerson {
  id: string;
  name: string;
  surname?: string | null;
  nickname?: string | null;
  displayNameOverride?: string | null;
  photo?: string | null;
  /** ISO date string of the last contact, if any. */
  lastContact: string | null;
  groups: PersonGroupChip[];
  /** Label of the relationship to you the person has now, if any. */
  currentRelationship?: string | null;
}

interface RelationshipTypeMembersManagerProps {
  typeId: string;
  typeLabel: string;
  currentMembers: TypePerson[];
  /** Everyone who does not have this relationship yet. */
  availablePeople: TypePerson[];
  nameOrder?: 'WESTERN' | 'EASTERN';
  nameDisplayFormat?: NameDisplayFormat;
  dateFormat?: DateFormat;
}

/** Rows rendered in the checklist at once, to keep long lists fast on phones. */
const MAX_CHECKLIST_ROWS = 200;

function GroupChips({ groups }: { groups: PersonGroupChip[] }) {
  if (groups.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {groups.map((group) => (
        <span
          key={group.id}
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
          style={{
            backgroundColor: group.color ? `${group.color}20` : 'var(--badge-bg)',
            color: group.color || 'var(--badge-text)',
          }}
        >
          {group.name}
        </span>
      ))}
    </div>
  );
}

export default function RelationshipTypeMembersManager({
  typeId,
  typeLabel,
  currentMembers,
  availablePeople,
  nameOrder,
  nameDisplayFormat,
  dateFormat = 'MDY',
}: RelationshipTypeMembersManagerProps) {
  const t = useTranslations('relationshipTypes.members');
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [checklistQuery, setChecklistQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);

  const withoutRelationship = useMemo(
    () =>
      availablePeople
        .filter((person) => !person.currentRelationship)
        .map((person) => ({ person, label: formatFullName(person, nameOrder) })),
    [availablePeople, nameOrder]
  );
  const filtered = useMemo(
    () => filterByLabel(withoutRelationship, checklistQuery).slice(0, MAX_CHECKLIST_ROWS),
    [withoutRelationship, checklistQuery]
  );
  const filteredIds = useMemo(() => filtered.map((row) => row.person.id), [filtered]);
  const allState = selectionState(selected, filteredIds);

  // Selected people that are gone after a refresh (for example added) drop out
  const availableIdsKey = withoutRelationship.map((row) => row.person.id).join(',');
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(availableIdsKey.split(',').filter(Boolean));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [availableIdsKey]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = allState === 'some';
    }
  }, [allState]);

  // Photo lookup for the pill suggestions
  const photoMap = new Map<string, string | null>();
  for (const p of availablePeople) photoMap.set(p.id, p.photo ?? null);

  const pillItems = availablePeople.map((person) => ({
    id: person.id,
    label: formatFullName(person, nameOrder),
    currentRelationship: person.currentRelationship ?? null,
  }));

  const addPerson = async (personId: string): Promise<boolean> => {
    const response = await fetch(`/api/relationship-types/${typeId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId }),
    });
    if (!response.ok) {
      const data = await response.json();
      toast.error(data.error || t('errorAdd'));
      return false;
    }
    return true;
  };

  const handleAdd = async (item: { id: string; label: string }) => {
    setIsLoading(true);
    try {
      if (await addPerson(item.id)) {
        toast.success(t('addedSuccess', { name: item.label, type: typeLabel }));
        router.refresh();
      }
    } catch {
      toast.error(t('errorConnection'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async (member: TypePerson) => {
    const name = formatGraphName(member, nameOrder, nameDisplayFormat);
    setIsLoading(true);
    try {
      const response = await fetch(`/api/relationship-types/${typeId}/members/${member.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || t('errorRemove'));
        return;
      }

      toast.success(t('removedSuccess', { name, type: typeLabel }), {
        action: {
          label: t('undo'),
          onClick: () => {
            addPerson(member.id)
              .then((ok) => {
                if (ok) router.refresh();
              })
              .catch(() => toast.error(t('errorConnection')));
          },
        },
      });
      router.refresh();
    } catch {
      toast.error(t('errorConnection'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSelected = async () => {
    const personIds = [...selected];
    if (personIds.length === 0) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/relationship-types/${typeId}/members/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personIds }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || t('errorAdd'));
        return;
      }

      toast.success(t('bulkAddedSuccess', { count: data.updated, type: typeLabel }));
      setSelected(new Set());
      router.refresh();
    } catch {
      toast.error(t('errorConnection'));
    } finally {
      setIsLoading(false);
    }
  };

  const customRenderSuggestion = (item: { id: string; label: string; currentRelationship?: string | null }) => (
    <>
      <PersonAvatar personId={item.id} name={item.label} photo={photoMap.get(item.id)} size={20} />
      <span className="text-foreground">{item.label}</span>
      {item.currentRelationship && (
        <span className="ml-auto text-xs text-muted">{item.currentRelationship}</span>
      )}
    </>
  );

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-medium text-foreground mb-2">
          {t('label', { count: currentMembers.length })}
        </h2>

        {currentMembers.length === 0 ? (
          <p className="text-sm text-muted border border-dashed border-border rounded-lg px-4 py-6 text-center">
            {t('empty', { type: typeLabel })}
          </p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-surface-elevated hidden sm:table-header-group">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    {t('columnName')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    {t('columnGroups')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    {t('columnLastContact')}
                  </th>
                  <th className="px-4 py-2">
                    <span className="sr-only">{t('remove')}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {currentMembers.map((member) => {
                  const name = formatFullName(member, nameOrder);
                  const lastContact = member.lastContact
                    ? formatDate(parseCalendarDate(member.lastContact), dateFormat)
                    : null;
                  return (
                    <tr key={member.id} className="hover:bg-surface-elevated">
                      <td className="px-4 py-2">
                        <Link
                          href={`/people/${member.id}`}
                          className="flex items-center gap-3 min-h-11 text-sm font-medium text-primary hover:underline"
                        >
                          <PersonAvatar personId={member.id} name={name} photo={member.photo} size={32} />
                          <span className="min-w-0 break-words">{name}</span>
                        </Link>
                        <div className="sm:hidden pl-11 pb-1 space-y-1">
                          <GroupChips groups={member.groups} />
                          <div className="text-xs text-muted">
                            {t('lastContactLine', { date: lastContact ?? t('never') })}
                          </div>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-2">
                        {member.groups.length > 0 ? (
                          <GroupChips groups={member.groups} />
                        ) : (
                          <span className="text-sm text-muted">-</span>
                        )}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-2 whitespace-nowrap text-sm text-muted">
                        {lastContact ?? '-'}
                      </td>
                      <td className="px-2 sm:px-4 py-2 text-right align-top sm:align-middle">
                        <button
                          type="button"
                          onClick={() => handleRemove(member)}
                          disabled={isLoading}
                          className="inline-flex items-center justify-center w-11 h-11 sm:w-8 sm:h-8 rounded-md text-muted hover:bg-surface hover:text-foreground disabled:opacity-50"
                          aria-label={`${t('remove')} ${name}`}
                          title={t('remove')}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-foreground mb-2">{t('addTitle')}</h2>
        <PillSelector
          selectedItems={[]}
          availableItems={pillItems}
          onAdd={handleAdd}
          onRemove={() => undefined}
          placeholder={t('placeholder')}
          emptyMessage={t('emptyMessage')}
          helpText={t('helpText')}
          allSelectedMessage={t('allSelected')}
          isLoading={isLoading}
          renderSuggestion={customRenderSuggestion}
        />
      </section>

      {withoutRelationship.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-foreground">
            {t('withoutRelationshipTitle', { count: withoutRelationship.length })}
          </h2>
          <p className="text-xs text-muted mb-3">
            {t('withoutRelationshipHelp', { type: typeLabel })}
          </p>

          <input
            type="search"
            value={checklistQuery}
            onChange={(e) => setChecklistQuery(e.target.value)}
            aria-label={t('searchChecklist')}
            placeholder={t('searchChecklist')}
            className="w-full mb-3 px-3 py-2 min-h-11 sm:min-h-0 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />

          {filtered.length === 0 ? (
            <p className="text-sm text-muted py-3">{t('noChecklistMatches')}</p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <label className="flex items-center gap-3 px-4 min-h-11 bg-surface-elevated cursor-pointer text-sm font-medium text-foreground">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allState === 'all'}
                  onChange={(e) => setSelected(setAllSelected(selected, filteredIds, e.target.checked))}
                  className="w-4 h-4 rounded border-border"
                />
                {checklistQuery.trim() ? t('selectAllMatching') : t('selectAll')}
              </label>
              <ul className="max-h-80 overflow-y-auto divide-y divide-border">
                {filtered.map(({ person, label }) => (
                  <li key={person.id}>
                    <label className="flex items-center gap-3 px-4 py-2 min-h-11 cursor-pointer hover:bg-surface-elevated">
                      <input
                        type="checkbox"
                        checked={selected.has(person.id)}
                        onChange={() => setSelected(toggleSelected(selected, person.id))}
                        className="w-4 h-4 rounded border-border flex-shrink-0"
                      />
                      <PersonAvatar personId={person.id} name={label} photo={person.photo} size={28} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-foreground break-words">{label}</span>
                        {person.groups.length > 0 && (
                          <span className="block mt-0.5">
                            <GroupChips groups={person.groups} />
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {withoutRelationship.length > filtered.length && !checklistQuery.trim() && (
            <p className="text-xs text-muted mt-2">
              {t('checklistTruncated', { count: filtered.length })}
            </p>
          )}

          <div className="mt-3 flex items-center gap-3">
            <Button onClick={handleAddSelected} disabled={isLoading || selected.size === 0}>
              {t('addSelected', { count: selected.size, type: typeLabel })}
            </Button>
            {selected.size > 0 && (
              <Button variant="ghost" onClick={() => setSelected(new Set())} disabled={isLoading}>
                {t('clearSelection')}
              </Button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
