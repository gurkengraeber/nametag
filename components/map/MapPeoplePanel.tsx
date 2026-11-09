'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { countries } from '@/lib/countries';
import type { UnplacedPerson, UnplacedReason } from '@/lib/map/types';

export type MapPanelTab = 'onMap' | 'noPlace';

/** One person with a marker on the map, as listed in the panel */
export interface PanelPerson {
  personId: string;
  personName: string;
  /** City and country text of the person's first visible marker */
  placeText: string;
}

interface MapPeoplePanelProps {
  tab: MapPanelTab;
  onTabChange: (tab: MapPanelTab) => void;
  onClose: () => void;
  onMap: PanelPerson[];
  unplaced: UnplacedPerson[];
  selectedIds: ReadonlySet<string>;
  onToggleSelected: (personId: string) => void;
  /** Centers the map on a person and opens their card */
  onShowOnMap: (personId: string) => void;
  geocodingEnabled: boolean;
  /** Country code preselected in the quick entry (the most common one on the map) */
  defaultCountry: string;
  /** Saves city and country for a person; resolves to true on success */
  onSavePlace: (person: UnplacedPerson, city: string, country: string) => Promise<boolean>;
  /** Leave room for the selection bar at the bottom */
  withSelectionBar: boolean;
}

const checkboxClasses = 'w-4 h-4 text-primary bg-surface-elevated border-border rounded focus:ring-primary';

function reasonKey(reason: UnplacedReason): string {
  return `reason.${reason}`;
}

interface UnplacedRowProps {
  person: UnplacedPerson;
  selected: boolean;
  onToggleSelected: (personId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  geocodingEnabled: boolean;
  defaultCountry: string;
  onSavePlace: (person: UnplacedPerson, city: string, country: string) => Promise<boolean>;
}

function UnplacedRow({
  person,
  selected,
  onToggleSelected,
  open,
  onOpenChange,
  geocodingEnabled,
  defaultCountry,
  onSavePlace,
}: UnplacedRowProps) {
  const t = useTranslations('map');
  const [city, setCity] = useState(person.addresses[0]?.locality ?? '');
  const [country, setCountry] = useState(person.addresses[0]?.country ?? defaultCountry);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving || (!city.trim() && !country)) return;
    setSaving(true);
    setFailed(false);
    const ok = await onSavePlace(person, city, country);
    setSaving(false);
    if (ok) {
      onOpenChange(false);
    } else {
      setFailed(true);
    }
  }

  const fieldClasses =
    'w-full min-h-11 sm:min-h-0 px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <li className="px-2 py-1 border-b border-border last:border-b-0">
      <div className="flex items-center gap-2 min-h-11">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelected(person.personId)}
          className={checkboxClasses}
          aria-label={t('selectPerson', { name: person.personName })}
        />
        <div className="min-w-0 flex-1">
          <Link
            href={`/people/${encodeURIComponent(person.personId)}`}
            className="block truncate text-sm text-foreground hover:text-primary transition-colors"
          >
            {person.personName}
          </Link>
          <p className="text-xs text-muted">{t(reasonKey(person.reason))}</p>
        </div>
        {geocodingEnabled && (
          <Button
            variant="secondary"
            size="sm"
            aria-expanded={open}
            onClick={() => onOpenChange(!open)}
          >
            {t('setPlace')}
          </Button>
        )}
      </div>
      {open && geocodingEnabled && (
        <form onSubmit={handleSubmit} className="pb-3 pl-6 space-y-2">
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            maxLength={100}
            autoFocus
            enterKeyHint="done"
            autoComplete="off"
            placeholder={t('cityPlaceholder')}
            aria-label={t('cityPlaceholder')}
            className={fieldClasses}
          />
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            aria-label={t('countryPlaceholder')}
            className={fieldClasses}
          >
            <option value="">{t('countryPlaceholder')}</option>
            {countries.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.name}
              </option>
            ))}
          </select>
          {failed && (
            <p role="alert" className="text-sm text-warning">
              {t('placeSaveFailed')}
            </p>
          )}
          <Button type="submit" size="sm" disabled={saving || (!city.trim() && !country)}>
            {saving ? t('savingPlace') : t('savePlace')}
          </Button>
        </form>
      )}
    </li>
  );
}

export default function MapPeoplePanel({
  tab,
  onTabChange,
  onClose,
  onMap,
  unplaced,
  selectedIds,
  onToggleSelected,
  onShowOnMap,
  geocodingEnabled,
  defaultCountry,
  onSavePlace,
  withSelectionBar,
}: MapPeoplePanelProps) {
  const t = useTranslations('map');
  const tCommon = useTranslations('common');
  const [openId, setOpenId] = useState<string | null>(null);

  const tabClasses = (active: boolean) =>
    `flex-1 min-h-11 sm:min-h-0 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
      active ? 'border-primary text-foreground' : 'border-transparent text-muted hover:text-foreground'
    }`;

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-20 max-h-[70%] sm:inset-y-0 sm:left-auto sm:right-0 sm:w-96 sm:max-h-none bg-surface border-t sm:border-t-0 sm:border-l border-border rounded-t-xl sm:rounded-none shadow-lg flex flex-col ${
        withSelectionBar ? 'pb-24 sm:pb-0' : ''
      }`}
      role="dialog"
      aria-label={t('openList')}
    >
      <div className="flex items-stretch border-b border-border">
        <button type="button" className={tabClasses(tab === 'onMap')} aria-pressed={tab === 'onMap'} onClick={() => onTabChange('onMap')}>
          {t('tabOnMap', { count: onMap.length })}
        </button>
        <button type="button" className={tabClasses(tab === 'noPlace')} aria-pressed={tab === 'noPlace'} onClick={() => onTabChange('noPlace')}>
          {t('tabNoPlace', { count: unplaced.length })}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={tCommon('close')}
          className="min-h-11 min-w-11 inline-flex items-center justify-center text-muted hover:text-foreground transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {tab === 'onMap' ? (
        onMap.length === 0 ? (
          <p className="p-4 text-sm text-muted">{t('listOnMapEmpty')}</p>
        ) : (
          <ul className="flex-1 overflow-y-auto p-2">
            {onMap.map((person) => (
              <li key={person.personId} className="flex items-center gap-2 px-2 min-h-11 border-b border-border last:border-b-0">
                <input
                  type="checkbox"
                  checked={selectedIds.has(person.personId)}
                  onChange={() => onToggleSelected(person.personId)}
                  className={checkboxClasses}
                  aria-label={t('selectPerson', { name: person.personName })}
                />
                <button
                  type="button"
                  onClick={() => onShowOnMap(person.personId)}
                  className="min-w-0 flex-1 text-left py-1"
                  aria-label={t('showPersonOnMap', { name: person.personName })}
                >
                  <span className="block truncate text-sm text-foreground">{person.personName}</span>
                  {person.placeText && <span className="block truncate text-xs text-muted">{person.placeText}</span>}
                </button>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="flex-1 overflow-y-auto">
          <p className="px-4 pt-3 text-sm text-muted">
            {geocodingEnabled ? t('noPlaceHint') : t('geocodingOffHint')}
          </p>
          {unplaced.length === 0 ? (
            <p className="p-4 text-sm text-muted">{t('listNoPlaceEmpty')}</p>
          ) : (
            <ul className="p-2">
              {unplaced.map((person) => (
                <UnplacedRow
                  key={person.personId}
                  person={person}
                  selected={selectedIds.has(person.personId)}
                  onToggleSelected={onToggleSelected}
                  open={openId === person.personId}
                  onOpenChange={(open) => setOpenId(open ? person.personId : null)}
                  geocodingEnabled={geocodingEnabled}
                  defaultCountry={defaultCountry}
                  onSavePlace={onSavePlace}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
