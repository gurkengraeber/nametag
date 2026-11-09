'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import GroupsSelector from './GroupsSelector';
import LastContactQuickUpdate from './LastContactQuickUpdate';
import { Button } from './ui/Button';
import { appendNote, diffIds, MAX_NOTES_LENGTH } from '@/lib/person-profile';
import type { DateFormat } from '@/lib/date-format';

interface RelationshipTypeOption {
  id: string;
  label: string;
}

interface GroupOption {
  id: string;
  name: string;
  color: string | null;
}

interface PersonQuickActionsProps {
  personId: string;
  relationshipToUserId: string | null;
  relationshipTypes: RelationshipTypeOption[];
  groups: GroupOption[];
  selectedGroupIds: string[];
  notes: string | null;
  currentLastContact: string | null;
  dateFormat: DateFormat;
  contactReminderDescription?: string | null;
}

const selectClass =
  'w-full px-3 py-2 min-h-11 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50';

/**
 * Edit the things people change most often straight from the profile:
 * last contact, relationship to you, groups and a quick note. Every change is
 * saved immediately through the existing person and group member endpoints.
 */
export default function PersonQuickActions({
  personId,
  relationshipToUserId,
  relationshipTypes,
  groups,
  selectedGroupIds,
  notes,
  currentLastContact,
  dateFormat,
  contactReminderDescription,
}: PersonQuickActionsProps) {
  const t = useTranslations('people.quickActions');
  const tPeople = useTranslations('people');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [relationshipId, setRelationshipId] = useState(relationshipToUserId ?? '');
  const [isSavingRelationship, setIsSavingRelationship] = useState(false);

  const [groupIds, setGroupIds] = useState(selectedGroupIds);
  const [isSavingGroups, setIsSavingGroups] = useState(false);

  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteError, setNoteError] = useState('');

  useEffect(() => {
    setRelationshipId(relationshipToUserId ?? '');
  }, [relationshipToUserId]);

  const groupIdsKey = selectedGroupIds.join(',');
  useEffect(() => {
    setGroupIds(selectedGroupIds);
    // groupIdsKey captures the content of selectedGroupIds
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIdsKey]);

  async function handleRelationshipChange(nextId: string) {
    const previous = relationshipId;
    setRelationshipId(nextId);
    setIsSavingRelationship(true);
    try {
      const response = await fetch(`/api/people/${personId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relationshipToUserId: nextId || null }),
      });
      if (!response.ok) throw new Error('Failed to update');
      toast.success(tPeople('relationshipUpdated'));
      router.refresh();
    } catch {
      setRelationshipId(previous);
      toast.error(t('relationshipError'));
    } finally {
      setIsSavingRelationship(false);
    }
  }

  async function handleGroupsChange(nextIds: string[]) {
    const previous = groupIds;
    const { added, removed } = diffIds(previous, nextIds);
    if (added.length === 0 && removed.length === 0) return;

    setGroupIds(nextIds);
    setIsSavingGroups(true);
    try {
      const requests = [
        ...added.map((groupId) =>
          fetch(`/api/groups/${groupId}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personId }),
          })
        ),
        ...removed.map((groupId) =>
          fetch(`/api/groups/${groupId}/members/${personId}`, { method: 'DELETE' })
        ),
      ];
      const responses = await Promise.all(requests);
      if (responses.some((response) => !response.ok)) {
        throw new Error('Failed to update groups');
      }
      toast.success(t('groupsSaved'));
      router.refresh();
    } catch {
      setGroupIds(previous);
      toast.error(t('groupsError'));
      router.refresh();
    } finally {
      setIsSavingGroups(false);
    }
  }

  async function handleSaveNote(event: React.FormEvent) {
    event.preventDefault();
    const combined = appendNote(notes, noteText);
    if (combined === null) {
      setNoteError(noteText.trim() ? t('noteTooLong', { max: MAX_NOTES_LENGTH }) : t('noteEmpty'));
      return;
    }

    setNoteError('');
    setIsSavingNote(true);
    try {
      const response = await fetch(`/api/people/${personId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: combined }),
      });
      if (!response.ok) throw new Error('Failed to save note');
      toast.success(t('noteSaved'));
      setNoteText('');
      setShowNote(false);
      router.refresh();
    } catch {
      toast.error(t('noteError'));
    } finally {
      setIsSavingNote(false);
    }
  }

  return (
    <div className="px-6 py-5 border-b border-border space-y-5" data-testid="person-quick-actions">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label
            htmlFor="quick-relationship"
            className="block text-sm font-medium text-muted mb-1"
          >
            {t('relationshipLabel')}
          </label>
          <select
            id="quick-relationship"
            value={relationshipId}
            disabled={isSavingRelationship}
            onChange={(e) => handleRelationshipChange(e.target.value)}
            className={selectClass}
          >
            <option value="">{t('relationshipNone')}</option>
            {relationshipTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <LastContactQuickUpdate
          personId={personId}
          currentLastContact={currentLastContact}
          dateFormat={dateFormat}
          contactReminderDescription={contactReminderDescription}
        />
      </div>

      <div>
        <span className="block text-sm font-medium text-muted mb-1">{t('groupsLabel')}</span>
        <GroupsSelector
          availableGroups={groups}
          selectedGroupIds={groupIds}
          onChange={handleGroupsChange}
          showCreateHint={false}
        />
        {isSavingGroups && (
          <p className="text-xs text-muted mt-1" role="status">
            {tPeople('saving')}
          </p>
        )}
      </div>

      <div>
        {showNote ? (
          <form onSubmit={handleSaveNote} className="space-y-2">
            <label htmlFor="quick-note" className="block text-sm font-medium text-muted">
              {t('noteLabel')}
            </label>
            <textarea
              id="quick-note"
              value={noteText}
              onChange={(e) => {
                setNoteText(e.target.value);
                setNoteError('');
              }}
              rows={3}
              placeholder={t('notePlaceholder')}
              aria-invalid={noteError ? true : undefined}
              aria-describedby={noteError ? 'quick-note-error' : undefined}
              autoFocus
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {noteError && (
              <p id="quick-note-error" role="alert" className="text-sm text-warning">
                {noteError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                disabled={isSavingNote}
                onClick={() => {
                  setShowNote(false);
                  setNoteText('');
                  setNoteError('');
                }}
              >
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={isSavingNote}>
                {isSavingNote ? tPeople('saving') : t('noteSave')}
              </Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="secondary" onClick={() => setShowNote(true)}>
            {t('addNote')}
          </Button>
        )}
      </div>
    </div>
  );
}
