'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import GroupsSelector from './GroupsSelector';

interface ParsedVCardData {
  name?: string;
  surname?: string;
  middleName?: string;
  prefix?: string;
  suffix?: string;
  nickname?: string;
  organization?: string;
  jobTitle?: string;
  emails?: Array<{ email: string; type: string }>;
  phoneNumbers?: Array<{ number: string; type: string }>;
}

interface PendingImport {
  id: string;
  uid: string;
  href: string;
  vCardData: string;
  displayName: string;
  discoveredAt: Date;
}

interface Group {
  id: string;
  name: string;
  color: string | null;
}

interface RelationshipType {
  id: string;
  label: string;
  color: string | null;
}

interface CompactContactRowProps {
  pendingImport: PendingImport;
  isSelected: boolean;
  onToggle: (id: string) => void;
  availableGroups: Group[];
  selectedGroupIds: string[];
  onGroupsChange: (contactId: string, groupIds: string[]) => void;
  onGroupCreated?: (group: Group) => void;
  parsedData: ParsedVCardData | null;
  relationshipTypes: RelationshipType[];
  selectedRelationshipTypeId: string;
  onRelationshipChange: (contactId: string, relationshipTypeId: string) => void;
  isExisting?: boolean;
  willUpdate?: boolean;
  onToggleUpdate?: (id: string) => void;
}

export default function CompactContactRow({
  pendingImport,
  isSelected,
  onToggle,
  availableGroups,
  selectedGroupIds,
  onGroupsChange,
  onGroupCreated,
  parsedData,
  relationshipTypes,
  selectedRelationshipTypeId,
  onRelationshipChange,
  isExisting = false,
  willUpdate = false,
  onToggleUpdate,
}: CompactContactRowProps) {
  const t = useTranslations('settings.carddav.import');
  const [isExpanded, setIsExpanded] = useState(false);

  // Format full name from parsed vCard data
  const formatFullName = (parsed: ParsedVCardData | null): string => {
    if (!parsed) return pendingImport.displayName;

    const parts = [
      parsed.prefix,
      parsed.name,
      parsed.middleName,
      parsed.surname,
      parsed.suffix,
    ].filter(Boolean);

    let fullName = parts.join(' ');

    if (parsed.nickname) {
      fullName += ` (${parsed.nickname})`;
    }

    return fullName || pendingImport.displayName;
  };

  const fullName = formatFullName(parsedData);
  const secondary = [
    parsedData?.organization,
    parsedData?.emails?.[0]?.email,
    parsedData?.phoneNumbers?.[0]?.number,
  ]
    .filter(Boolean)
    .join(' · ');
  const relType =
    selectedRelationshipTypeId && selectedRelationshipTypeId !== '__none__'
      ? relationshipTypes.find((rt) => rt.id === selectedRelationshipTypeId)
      : undefined;

  return (
    <div
      className={`border rounded-lg transition-colors ${
        isSelected
          ? 'border-primary bg-primary/10'
          : 'border-border hover:border-border'
      }`}
    >
      {/* Compact row: the whole name area is the touch target for selecting */}
      <div className="flex items-stretch">
        <label className="flex flex-1 min-w-0 items-start gap-3 p-3 min-h-11 cursor-pointer">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggle(pendingImport.id)}
            className="mt-1 w-4 h-4 rounded border-border text-primary focus:ring-primary flex-shrink-0"
            aria-label={t('selectContact', { name: fullName })}
          />
          <span className="flex-1 min-w-0">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-foreground break-words">{fullName}</span>
              {isExisting && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 flex-shrink-0">
                  {t('alreadyExists')}
                </span>
              )}
            </span>
            {secondary && <span className="block text-sm text-muted break-words">{secondary}</span>}
            {(selectedGroupIds.length > 0 || relType) && (
              <span className="mt-1 flex flex-wrap gap-1">
                {selectedGroupIds.map((groupId) => {
                  const group = availableGroups.find((g) => g.id === groupId);
                  if (!group) return null;
                  return (
                    <span
                      key={groupId}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-elevated rounded-full text-xs font-medium text-foreground"
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: group.color || 'var(--badge-bg)' }}
                      />
                      {group.name}
                    </span>
                  );
                })}
                {relType && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-elevated rounded-full text-xs font-medium text-foreground">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: relType.color || 'var(--badge-bg)' }}
                    />
                    {relType.label}
                  </span>
                )}
              </span>
            )}
          </span>
        </label>

        {/* Expand/Collapse button */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-muted hover:text-foreground transition-colors flex-shrink-0 min-h-11 min-w-11 flex items-center justify-center"
          aria-label={isExpanded ? t('collapseDetails') : t('expandDetails')}
          aria-expanded={isExpanded}
        >
          <svg
            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t border-border mt-2">
          {isExisting && onToggleUpdate && (
            <label className="flex items-center gap-3 mt-2 min-h-11 cursor-pointer">
              <input
                type="checkbox"
                checked={willUpdate}
                onChange={() => onToggleUpdate(pendingImport.id)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium text-foreground">
                {t('updateExisting')}
              </span>
            </label>
          )}
          {parsedData && (
            <div className="mt-2 space-y-1 text-sm text-muted">
              {parsedData.jobTitle && (
                <p>
                  <span className="font-medium">{t('jobTitle')}:</span>{' '}
                  {parsedData.jobTitle}
                </p>
              )}
            </div>
          )}
          <div className="mt-3">
            <label className="block text-sm font-medium text-foreground mb-1">
              {t('contactGroups')}
            </label>
            <GroupsSelector
              availableGroups={availableGroups}
              selectedGroupIds={selectedGroupIds}
              onChange={(groupIds) => onGroupsChange(pendingImport.id, groupIds)}
              onGroupCreated={onGroupCreated}
              showCreateHint={false}
            />
          </div>
          {relationshipTypes.length > 0 && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('contactRelationship')}
              </label>
              <select
                value={selectedRelationshipTypeId}
                onChange={(e) => onRelationshipChange(pendingImport.id, e.target.value)}
                className="w-full max-w-xs px-3 py-2 border border-border rounded-lg bg-surface text-foreground text-base sm:text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="">{t('useGlobalRelationship')}</option>
                <option value="__none__">{t('noRelationship')}</option>
                {relationshipTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
