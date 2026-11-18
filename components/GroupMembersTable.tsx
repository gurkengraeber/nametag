'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BulkRelationshipModal from './BulkRelationshipModal';
import PersonAvatar from './PersonPhoto';
import {
  RelationshipCell,
  LastContactCell,
  LocationCell,
  toDateInputValue,
  type QuickEditRelationshipType,
} from './QuickEditCells';
import { formatCanonicalName, type NameDisplayFormat } from '@/lib/nameUtils';
import { setAllSelected, toggleSelected } from '@/lib/people-selection';

interface GroupMemberConnection {
  id: string;
  name: string;
  middleName: string | null;
  surname: string | null;
  secondLastName: string | null;
  nickname: string | null;
  typeLabel: string | null;
}

interface GroupMemberRow {
  id: string;
  name: string;
  middleName: string | null;
  surname: string | null;
  secondLastName: string | null;
  nickname: string | null;
  displayNameOverride: string | null;
  photo: string | null;
  lastContact: Date | string | null;
  relationshipToUserId: string | null;
  addresses: Array<{ locality: string | null; country: string | null }>;
  /** This person's relationships to other people, in either direction already merged. */
  connections: GroupMemberConnection[];
}

export interface GroupMembersTableProps {
  members: GroupMemberRow[];
  relationshipTypes: QuickEditRelationshipType[];
  nameOrder?: 'WESTERN' | 'EASTERN';
  nameDisplayFormat?: NameDisplayFormat;
}

const MAX_VISIBLE_CONNECTIONS = 6;

/**
 * The relationships of one member to other people. Connections to other
 * members of the same group come first and are highlighted.
 */
function ConnectionsCell({
  connections,
  memberIds,
  nameOrder,
  nameDisplayFormat,
}: {
  connections: GroupMemberConnection[];
  memberIds: Set<string>;
  nameOrder?: 'WESTERN' | 'EASTERN';
  nameDisplayFormat?: NameDisplayFormat;
}) {
  const t = useTranslations('groups.members');

  if (connections.length === 0) {
    return <span className="text-sm text-muted">{'\u2014'}</span>;
  }

  const ordered = [...connections].sort(
    (a, b) => Number(memberIds.has(b.id)) - Number(memberIds.has(a.id)),
  );
  const visible = ordered.slice(0, MAX_VISIBLE_CONNECTIONS);
  const hidden = ordered.slice(MAX_VISIBLE_CONNECTIONS);

  return (
    <div className="flex flex-wrap gap-1 min-w-[14rem] max-w-sm">
      {visible.map((connection, index) => {
        const inGroup = memberIds.has(connection.id);
        return (
          <Link
            // The same person can be connected through several relationship types
            key={`${connection.id}:${index}`}
            href={`/people/${connection.id}`}
            title={inGroup ? t('connectionInGroup') : undefined}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs whitespace-nowrap transition-colors ${
              inGroup
                ? 'bg-primary/10 text-primary font-medium hover:bg-primary/20'
                : 'bg-surface-elevated text-muted hover:text-foreground'
            }`}
          >
            {connection.typeLabel && <span className="opacity-70">{connection.typeLabel}:</span>}
            <span>{formatCanonicalName(connection, nameOrder, nameDisplayFormat)}</span>
          </Link>
        );
      })}
      {hidden.length > 0 && (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-xs text-muted"
          title={hidden.map((connection) => formatCanonicalName(connection, nameOrder, nameDisplayFormat)).join(', ')}
        >
          {t('moreConnections', { count: hidden.length })}
        </span>
      )}
    </div>
  );
}

const checkboxClass = 'w-4 h-4 text-primary bg-surface-elevated border-border rounded focus:ring-primary';
const toolbarButtonClass =
  'px-3 py-1.5 min-h-11 sm:min-h-0 text-sm font-medium text-foreground bg-surface-elevated border border-border rounded-lg hover:bg-surface-elevated/80 transition-colors';

/**
 * The members of a group as a table whose relationship, last contact and
 * location can be changed in place, so people do not have to be opened one by one.
 * Members can be ticked to give several of them the same relationship at once.
 */
export default function GroupMembersTable({
  members,
  relationshipTypes,
  nameOrder,
  nameDisplayFormat,
}: GroupMembersTableProps) {
  const t = useTranslations('groups.members');
  const tPeople = useTranslations('people');
  const tBulk = useTranslations('people.bulk');
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);

  const memberIdList = useMemo(() => members.map((member) => member.id), [members]);
  // Members who left the group since they were ticked no longer count.
  const selectedIds = memberIdList.filter((id) => selected.has(id));
  const allSelected = memberIdList.length > 0 && selectedIds.length === memberIdList.length;

  if (members.length === 0) {
    return null;
  }

  const memberIds = new Set(memberIdList);

  const sortedMembers = [...members].sort((a, b) =>
    formatCanonicalName(a, nameOrder).localeCompare(formatCanonicalName(b, nameOrder)),
  );

  const clearSelection = () => setSelected(new Set());

  return (
    <div>
      {/* Always rendered so ticking the first box does not push the rows down under the pointer. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 border border-border rounded-lg bg-surface-elevated">
        <span className="text-sm font-medium text-foreground">
          {selectedIds.length > 0 ? tBulk('selected', { count: selectedIds.length }) : t('selectHint')}
        </span>
        <button
          type="button"
          onClick={() => setShowRelationshipModal(true)}
          disabled={selectedIds.length === 0}
          className={`${toolbarButtonClass} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {tBulk('setRelationship')}
        </button>
        {selectedIds.length > 0 && (
          <button type="button" onClick={clearSelection} className="text-sm text-muted hover:text-foreground transition-colors">
            {tBulk('clearSelection')}
          </button>
        )}
      </div>
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-surface-elevated">
            <tr>
              <th className="pl-4 pr-2 py-2 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelected((prev) => setAllSelected(prev, memberIdList, !allSelected))}
                  className={checkboxClass}
                  title={tBulk('selectAll')}
                  aria-label={tBulk('selectAll')}
                />
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted uppercase tracking-wider">
                {tPeople('fullName')}
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted uppercase tracking-wider">
                {tPeople('relationshipToUser')}
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted uppercase tracking-wider">
                {tPeople('lastContact')}
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted uppercase tracking-wider">
                {tPeople('quickEdit.location')}
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted uppercase tracking-wider">
                {t('connections')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-surface divide-y divide-border">
            {sortedMembers.map((member) => {
              const fullName = formatCanonicalName(member, nameOrder);
              const displayName = formatCanonicalName(member, nameOrder, nameDisplayFormat);
              const isChecked = selected.has(member.id);
              return (
                <tr
                  key={member.id}
                  className={`hover:bg-surface-elevated transition-colors ${isChecked ? 'bg-primary/5' : ''}`}
                >
                  <td className="pl-4 pr-2 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => setSelected((prev) => toggleSelected(prev, member.id))}
                      className={checkboxClass}
                      aria-label={displayName}
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <PersonAvatar personId={member.id} name={fullName} photo={member.photo} size={28} />
                      <Link href={`/people/${member.id}`} className="text-primary hover:underline font-medium">
                        {displayName}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <RelationshipCell
                      personId={member.id}
                      value={member.relationshipToUserId}
                      types={relationshipTypes}
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <LastContactCell personId={member.id} value={toDateInputValue(member.lastContact)} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <LocationCell
                      personId={member.id}
                      city={member.addresses[0]?.locality ?? null}
                      country={member.addresses[0]?.country ?? null}
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <ConnectionsCell
                      connections={member.connections}
                      memberIds={memberIds}
                      nameOrder={nameOrder}
                      nameDisplayFormat={nameDisplayFormat}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <BulkRelationshipModal
        isOpen={showRelationshipModal}
        onClose={() => setShowRelationshipModal(false)}
        selectedIds={selectedIds}
        selectAll={false}
        totalCount={selectedIds.length}
        relationshipTypes={relationshipTypes}
        onSuccess={() => {
          setShowRelationshipModal(false);
          clearSelection();
          router.refresh();
        }}
      />
    </div>
  );
}
