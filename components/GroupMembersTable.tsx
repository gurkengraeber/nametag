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
}

interface GroupMembersTableProps {
  members: GroupMemberRow[];
  relationshipTypes: QuickEditRelationshipType[];
  nameOrder?: 'WESTERN' | 'EASTERN';
  nameDisplayFormat?: NameDisplayFormat;
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

  const sortedMembers = [...members].sort((a, b) =>
    formatCanonicalName(a, nameOrder).localeCompare(formatCanonicalName(b, nameOrder)),
  );

  return (
    <div className="mt-6">
      <h2 className="text-sm font-medium text-foreground mb-2">{t('tableTitle')}</h2>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
