'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { formatDate, getLocalDateString, type DateFormat } from '@/lib/date-format';
import { describeLastContact } from '@/lib/map/last-contact';
import { addPersonToGroup, markContactedToday, setPersonRelationship } from '@/lib/map/quick-actions';
import type { MapGroup, MapMarker, MapPerson, MapRelationshipType } from '@/lib/map/types';

interface MapPersonCardProps {
  /** Markers at the clicked place; more than one when people share an address */
  markers: MapMarker[];
  peopleById: ReadonlyMap<string, MapPerson>;
  relationshipTypes: MapRelationshipType[];
  allGroups: MapGroup[];
  dateFormat: DateFormat;
  onClose: () => void;
  /** Starts a selection with these people (opens the bulk actions) */
  onStartSelection: (personIds: string[]) => void;
  /** Applies a change to the local copy of a person right away (optimistic update) */
  onPersonChange: (personId: string, patch: Partial<MapPerson>) => void;
  /** Called after a change was saved, so the map can refresh from the server */
  onSaved: () => void;
}

export default function MapPersonCard({
  markers,
  peopleById,
  relationshipTypes,
  allGroups,
  dateFormat,
  onClose,
  onStartSelection,
  onPersonChange,
  onSaved,
}: MapPersonCardProps) {
  const t = useTranslations('map');
  const tPeople = useTranslations('people');
  const tCommon = useTranslations('common');
  const [activePersonId, setActivePersonId] = useState(markers[0]?.personId ?? '');
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Not modal: the map stays usable, so Tab may leave the card
  useFocusTrap(dialogRef, true, false);

  // One entry per person, keeping the first marker (its address) for the card.
  const entries: MapMarker[] = [];
  for (const marker of markers) {
    if (!entries.some((entry) => entry.personId === marker.personId)) entries.push(marker);
  }
  const marker = entries.find((entry) => entry.personId === activePersonId) ?? entries[0];
  if (!marker) return null;
  const person = peopleById.get(marker.personId);

  const groupsById = new Map(allGroups.map((group) => [group.id, group]));
  const memberGroups = (person?.groupIds ?? [])
    .map((id) => groupsById.get(id))
    .filter((group): group is MapGroup => group !== undefined);
  const addableGroups = allGroups.filter((group) => !(person?.groupIds ?? []).includes(group.id));

  // Applies the change locally first, undoes it when saving fails.
  async function save(patch: Partial<MapPerson>, revert: Partial<MapPerson>, call: () => Promise<boolean>) {
    onPersonChange(marker.personId, patch);
    setBusy(true);
    const ok = await call();
    setBusy(false);
    if (ok) {
      toast.success(t('cardSaved'));
      onSaved();
    } else {
      onPersonChange(marker.personId, revert);
      toast.error(t('cardSaveFailed'));
    }
  }

  const age = describeLastContact(person?.lastContact ?? null);
  const lastContactText = (() => {
    switch (age.kind) {
      case 'never':
        return t('cardNeverContacted');
      case 'today':
        return tPeople('today');
      case 'days':
        return age.count === 1 ? tPeople('oneDayAgo') : tPeople('daysAgo', { days: age.count });
      case 'months':
        return age.count === 1 ? tPeople('oneMonthAgo') : tPeople('monthsAgo', { months: age.count });
      case 'years':
        return age.count === 1 ? tPeople('oneYearAgo') : tPeople('yearsAgo', { years: age.count });
    }
  })();

  const fieldClasses =
    'w-full min-h-11 sm:min-h-0 px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50';
  const labelClasses = 'block text-xs font-medium text-muted mb-1';

  return (
    <div
      ref={dialogRef}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
      className="absolute inset-x-0 bottom-0 z-30 sm:inset-x-auto sm:left-4 sm:bottom-4 sm:w-96 max-h-[75%] overflow-y-auto bg-surface border-t sm:border border-border rounded-t-xl sm:rounded-lg shadow-lg p-4 pb-[calc(theme(spacing.4)+env(safe-area-inset-bottom))] sm:pb-4"
      role="dialog"
      aria-label={marker.personName}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground break-words">{marker.personName}</h2>
          <p className="text-xs text-muted capitalize">{marker.label}</p>
          {marker.addressText && <p className="text-xs text-muted mt-0.5">{marker.addressText}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={tCommon('close')}
          className="shrink-0 min-h-11 min-w-11 -mt-2 -mr-2 inline-flex items-center justify-center text-muted hover:text-foreground transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {entries.length > 1 && (
        <div className="mt-3">
          <p className={labelClasses}>{t('colocatedTitle', { count: entries.length })}</p>
          <div className="flex flex-wrap gap-2">
            {entries.map((entry) => (
              <button
                key={entry.personId}
                type="button"
                aria-pressed={entry.personId === marker.personId}
                onClick={() => setActivePersonId(entry.personId)}
                className={`min-h-11 sm:min-h-0 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  entry.personId === marker.personId
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface text-foreground border-border hover:bg-surface-elevated'
                }`}
              >
                {entry.personName}
              </button>
            ))}
          </div>
        </div>
      )}

      {person && (
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="map-card-relationship" className={labelClasses}>
              {t('cardRelationship')}
            </label>
            <select
              id="map-card-relationship"
              value={person.relationshipTypeId ?? ''}
              disabled={busy}
              onChange={(e) => {
                const next = e.target.value || null;
                save({ relationshipTypeId: next }, { relationshipTypeId: person.relationshipTypeId }, () =>
                  setPersonRelationship(person.personId, next)
                );
              }}
              className={fieldClasses}
            >
              <option value="">{t('noRelationship')}</option>
              {relationshipTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className={labelClasses}>{t('cardGroups')}</p>
            {memberGroups.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5 mb-2">
                {memberGroups.map((group) => (
                  <li
                    key={group.id}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-surface-elevated border border-border text-foreground"
                  >
                    {group.color && (
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: group.color }}
                        aria-hidden="true"
                      />
                    )}
                    {group.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted mb-2">{t('cardNoGroups')}</p>
            )}
            {addableGroups.length > 0 && (
              <select
                value=""
                disabled={busy}
                aria-label={t('cardAddGroup')}
                onChange={(e) => {
                  const group = groupsById.get(e.target.value);
                  if (!group) return;
                  save({ groupIds: [...person.groupIds, group.id] }, { groupIds: person.groupIds }, () =>
                    addPersonToGroup(person.personId, group.id)
                  );
                }}
                className={fieldClasses}
              >
                <option value="">{t('cardAddGroup')}</option>
                {addableGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <p className={labelClasses}>{tPeople('lastTimeTalked')}</p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-foreground">
                {person.lastContact ? (
                  <>
                    {formatDate(person.lastContact, dateFormat)}{' '}
                    <span className="text-muted">({lastContactText})</span>
                  </>
                ) : (
                  <span className="text-muted">{lastContactText}</span>
                )}
              </p>
              {age.kind !== 'today' && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    save({ lastContact: getLocalDateString() }, { lastContact: person.lastContact }, () =>
                      markContactedToday(person.personId)
                    )
                  }
                >
                  {t('contactedToday')}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button href={`/people/${encodeURIComponent(marker.personId)}`} size="sm">
          {t('viewContact')}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onStartSelection(entries.map((entry) => entry.personId))}>
          {t('select')}
        </Button>
        <a
          href={`https://www.google.com/maps?q=${marker.latitude},${marker.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center min-h-11 sm:min-h-0 px-2 text-sm text-primary hover:text-primary-dark underline underline-offset-2"
        >
          {t('directions')}
        </a>
      </div>
    </div>
  );
}
