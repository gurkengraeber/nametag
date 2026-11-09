'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import PersonAvatar from './PersonPhoto';
import {
  RelationshipCell,
  LastContactCell,
  LocationCell,
  toDateInputValue,
  type QuickEditRelationshipType,
} from './QuickEditCells';
import { formatCanonicalName, type NameDisplayFormat } from '@/lib/nameUtils';

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

/**
 * The members of a group as a table whose relationship, last contact and
 * location can be changed in place, so people do not have to be opened one by one.
 */
export default function GroupMembersTable({
  members,
  relationshipTypes,
  nameOrder,
  nameDisplayFormat,
}: GroupMembersTableProps) {
  const t = useTranslations('groups.members');
  const tPeople = useTranslations('people');

  if (members.length === 0) {
    return null;
  }

  const memberIds = new Set(members.map((member) => member.id));

  const sortedMembers = [...members].sort((a, b) =>
    formatCanonicalName(a, nameOrder).localeCompare(formatCanonicalName(b, nameOrder)),
  );

  return (
    <div>
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-surface-elevated">
            <tr>
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
              return (
                <tr key={member.id} className="hover:bg-surface-elevated transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <PersonAvatar personId={member.id} name={fullName} photo={member.photo} size={28} />
                      <Link href={`/people/${member.id}`} className="text-primary hover:underline font-medium">
                        {formatCanonicalName(member, nameOrder, nameDisplayFormat)}
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
    </div>
  );
}
