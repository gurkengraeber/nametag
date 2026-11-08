'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import GroupMembersTable, { type GroupMembersTableProps } from './GroupMembersTable';
import UnifiedNetworkGraph from './UnifiedNetworkGraph';

type View = 'list' | 'network';

interface GroupMembersViewProps extends GroupMembersTableProps {
  groupId: string;
}

/**
 * The members of a group, either as an editable list with their connections
 * or as a network graph limited to the members of the group.
 */
export default function GroupMembersView({ groupId, ...tableProps }: GroupMembersViewProps) {
  const t = useTranslations('groups.members');
  const tPeople = useTranslations('people');
  const [view, setView] = useState<View>('list');

  if (tableProps.members.length === 0) {
    return null;
  }

  const buttonClass = (active: boolean) =>
    `px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? 'bg-primary text-on-primary' : 'bg-surface text-foreground hover:bg-surface-elevated'
    }`;

  return (
    <div>
      <div className="inline-flex mb-4 border border-border rounded-lg overflow-hidden" role="group" aria-label={t('viewLabel')}>
        <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')} className={buttonClass(view === 'list')}>
          {t('viewList')}
        </button>
        <button type="button" aria-pressed={view === 'network'} onClick={() => setView('network')} className={buttonClass(view === 'network')}>
          {t('viewNetwork')}
        </button>
      </div>

      {view === 'list' ? (
        <GroupMembersTable {...tableProps} />
      ) : (
        <div className="border border-border rounded-lg p-4">
          <UnifiedNetworkGraph
            apiEndpoint={`/api/dashboard/graph?includeGroupIds=${encodeURIComponent(groupId)}`}
            linkDistance={100}
            chargeStrength={-300}
            compact
          />
          <p className="text-xs text-muted mt-2">{tPeople('graphHelp')}</p>
        </div>
      )}
    </div>
  );
}
