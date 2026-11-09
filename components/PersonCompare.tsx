'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { getPhotoUrl } from '@/lib/photo-url';
import MergeSummaryList from '@/components/MergeSummaryList';
import {
  buildDefaultOverrides,
  compareRelationshipToUser,
  compareScalarFields,
  formatFieldValue,
  formatPersonLabel,
  isSecondarySelected,
  pickInitialPrimaryId,
  REL_TO_USER_OVERRIDE_KEY,
  summarizeMerge,
  getScalarValue,
  type MergeSelections,
  type PersonForCompare,
  type ScalarFieldKey,
} from '@/lib/merge-compare';

export type { MergeSelections, PersonForCompare };

interface PersonCompareProps {
  personA: PersonForCompare;
  personB: PersonForCompare;
  onSelectionsChange: (selections: MergeSelections) => void;
}

interface OptionCardProps {
  personId: string;
  name: string;
  groupName: string;
  checked: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}

/** One tappable value of a conflicting field. */
function OptionCard({ personId, name, groupName, checked, onSelect, children }: OptionCardProps) {
  return (
    <label
      className={`flex items-start gap-3 p-3 min-h-11 rounded-lg border-2 cursor-pointer transition-colors ${
        checked ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
      }`}
    >
      <input
        type="radio"
        name={groupName}
        value={personId}
        checked={checked}
        onChange={onSelect}
        className="mt-1 accent-primary"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted truncate">{name}</span>
        <span
          className={`block text-sm break-words ${
            checked ? 'text-foreground font-medium' : 'text-muted'
          }`}
        >
          {children}
        </span>
      </span>
    </label>
  );
}

export default function PersonCompare({
  personA,
  personB,
  onSelectionsChange,
}: PersonCompareProps) {
  const t = useTranslations('people.merge');

  const [primaryId, setPrimaryId] = useState(() => pickInitialPrimaryId(personA, personB));
  const primary = primaryId === personA.id ? personA : personB;
  const secondary = primaryId === personA.id ? personB : personA;

  // Conflicts are preselected (newer value wins) so the common case needs no taps.
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, string | null>>(
    () => {
      const initialPrimary = pickInitialPrimaryId(personA, personB);
      return initialPrimary === personA.id
        ? buildDefaultOverrides(personA, personB)
        : buildDefaultOverrides(personB, personA);
    }
  );

  // Notify parent on mount and whenever selections change
  useEffect(() => {
    onSelectionsChange({ primaryId, fieldOverrides });
  }, [primaryId, fieldOverrides, onSelectionsChange]);

  const handlePrimaryChange = (newPrimaryId: string) => {
    if (newPrimaryId === primaryId) return;
    const newPrimary = newPrimaryId === personA.id ? personA : personB;
    const newSecondary = newPrimaryId === personA.id ? personB : personA;
    setPrimaryId(newPrimaryId);
    setFieldOverrides(buildDefaultOverrides(newPrimary, newSecondary));
  };

  const handleFieldOverride = (fieldKey: string, fromPersonId: string) => {
    setFieldOverrides((prev) => {
      const next = { ...prev };
      const overrideKey = fieldKey === 'relationshipToUser' ? REL_TO_USER_OVERRIDE_KEY : fieldKey;
      if (fromPersonId === primaryId) {
        delete next[overrideKey];
      } else if (fieldKey === 'relationshipToUser') {
        next[overrideKey] = secondary.relationshipToUserId;
      } else {
        next[overrideKey] = getScalarValue(secondary, fieldKey as ScalarFieldKey);
      }
      return next;
    });
  };

  const scalarStates = useMemo(() => compareScalarFields(personA, personB), [personA, personB]);
  const relState = useMemo(() => compareRelationshipToUser(personA, personB), [personA, personB]);

  const conflicts = scalarStates.filter((f) => f.status === 'conflict');
  const unchanged = scalarStates.filter((f) => f.status === 'same' || f.status === 'oneSide');
  const relConflict = relState.status === 'conflict';
  const relUnchanged = relState.status === 'same' || relState.status === 'oneSide';
  const conflictCount = conflicts.length + (relConflict ? 1 : 0);
  const unchangedCount = unchanged.length + (relUnchanged ? 1 : 0);

  const summary = useMemo(
    () => summarizeMerge(primary, secondary, fieldOverrides),
    [primary, secondary, fieldOverrides]
  );

  const renderPrimaryOption = (person: PersonForCompare) => {
    const isPrimary = primaryId === person.id;
    return (
      <label
        key={person.id}
        className={`flex items-center gap-3 p-3 min-h-11 rounded-lg border-2 cursor-pointer transition-colors flex-1 ${
          isPrimary ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
      >
        <input
          type="radio"
          name="primary"
          value={person.id}
          checked={isPrimary}
          onChange={() => handlePrimaryChange(person.id)}
          className="accent-primary"
        />
        <div className="min-w-0">
          <span className="font-semibold text-foreground break-words">
            {formatPersonLabel(person)}
          </span>
          <span className={`ml-2 text-xs ${isPrimary ? 'font-medium text-primary' : 'text-muted'}`}>
            {isPrimary ? t('primary') : t('secondary')}
          </span>
        </div>
      </label>
    );
  };

  const renderScalarValue = (
    person: PersonForCompare,
    key: ScalarFieldKey,
    value: string | null
  ) =>
    key === 'photo' && value ? (
      <PhotoPreview personId={person.id} photo={value} name={formatPersonLabel(person)} />
    ) : (
      formatFieldValue(value, key) || t('empty')
    );

  return (
    <div className="space-y-6">
      {/* Primary Selection */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <p className="text-sm font-medium text-foreground mb-3">
          {t('selectPrimary')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          {renderPrimaryOption(personA)}
          {renderPrimaryOption(personB)}
        </div>
      </div>

      {/* Conflicting Fields */}
      {conflictCount > 0 ? (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">
              {t('conflictingFields')}
            </h3>
            <p className="text-xs text-muted mt-1">{t('preselectedHint')}</p>
          </div>

          <ul className="divide-y divide-border">
            {conflicts.map((field) => {
              const selectedId = field.key in fieldOverrides ? secondary.id : primary.id;
              return (
                <li key={field.key} className="p-4 bg-warning/5">
                  <p className="text-sm font-medium text-foreground mb-2">{t(field.labelKey)}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { person: personA, value: field.valA },
                      { person: personB, value: field.valB },
                    ].map(({ person, value }) => (
                      <OptionCard
                        key={person.id}
                        personId={person.id}
                        name={formatPersonLabel(person)}
                        groupName={`field-${field.key}`}
                        checked={selectedId === person.id}
                        onSelect={() => handleFieldOverride(field.key, person.id)}
                      >
                        {renderScalarValue(person, field.key, value)}
                      </OptionCard>
                    ))}
                  </div>
                </li>
              );
            })}

            {relConflict && (
              <li className="p-4 bg-warning/5">
                <p className="text-sm font-medium text-foreground mb-2">
                  {t('fieldRelationshipToUser')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { person: personA, value: relState.valA },
                    { person: personB, value: relState.valB },
                  ].map(({ person, value }) => {
                    const secondaryChosen = isSecondarySelected('relationshipToUser', fieldOverrides);
                    const checked = secondaryChosen ? person.id !== primaryId : person.id === primaryId;
                    return (
                      <OptionCard
                        key={person.id}
                        personId={person.id}
                        name={formatPersonLabel(person)}
                        groupName="field-relationshipToUser"
                        checked={checked}
                        onSelect={() => handleFieldOverride('relationshipToUser', person.id)}
                      >
                        {value || t('empty')}
                      </OptionCard>
                    );
                  })}
                </div>
              </li>
            )}
          </ul>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg p-4">
          <p className="text-sm text-muted">{t('noConflicts')}</p>
        </div>
      )}

      {/* Identical or one-sided fields stay collapsed */}
      {unchangedCount > 0 && (
        <details className="group bg-surface border border-border rounded-lg overflow-hidden">
          <summary className="flex items-center justify-between gap-3 px-4 min-h-11 py-2 cursor-pointer text-sm font-medium text-foreground select-none">
            <span>{t('unchangedFields', { count: unchangedCount })}</span>
            <svg
              className="w-4 h-4 text-muted transition-transform group-open:rotate-180"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <dl className="divide-y divide-border border-t border-border">
            {unchanged.map((field) => {
              const owner = field.valA !== null ? personA : personB;
              return (
                <div key={field.key} className="px-4 py-3 sm:flex sm:gap-4">
                  <dt className="text-xs font-medium text-muted sm:w-40 sm:flex-shrink-0">
                    {t(field.labelKey)}
                  </dt>
                  <dd className="text-sm text-foreground break-words min-w-0">
                    {renderScalarValue(owner, field.key, field.valA ?? field.valB)}
                    <span className="block text-xs text-muted">
                      {field.status === 'same' ? t('sameValue') : t('onlyOneHasValue')}
                    </span>
                  </dd>
                </div>
              );
            })}
            {relUnchanged && (
              <div className="px-4 py-3 sm:flex sm:gap-4">
                <dt className="text-xs font-medium text-muted sm:w-40 sm:flex-shrink-0">
                  {t('fieldRelationshipToUser')}
                </dt>
                <dd className="text-sm text-foreground break-words min-w-0">
                  {relState.valA ?? relState.valB ?? t('empty')}
                  <span className="block text-xs text-muted">
                    {relState.status === 'same' ? t('sameValue') : t('onlyOneHasValue')}
                  </span>
                </dd>
              </div>
            )}
          </dl>
        </details>
      )}

      {/* Summary Section */}
      <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          {t('summary')}
        </h3>

        <MergeSummaryList primary={primary} secondary={secondary} summary={summary} />
      </div>
    </div>
  );
}

/** Small photo preview thumbnail for comparing photos side by side. */
function PhotoPreview({ personId, photo, name }: { personId: string; photo: string; name: string }) {
  const url = getPhotoUrl(personId, photo);
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name}
      className="w-12 h-12 rounded-full object-cover border border-border"
    />
  );
}
