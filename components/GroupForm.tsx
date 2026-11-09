'use client';

import { useMemo, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import PillSelector from './PillSelector';
import { formatFullName } from '@/lib/nameUtils';
import { pickFreshColor } from '@/lib/color-choice';
import { findSimilarName } from '@/lib/name-similarity';
import ColorPicker from './ColorPicker';
import { Button } from './ui/Button';

interface Person {
  id: string;
  name: string;
  surname?: string | null;
  nickname?: string | null;
  displayNameOverride?: string | null;
}

interface GroupFormProps {
  group?: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
  };
  mode: 'create' | 'edit';
  availablePeople?: Person[]; // Only used in create mode
  nameOrder?: 'WESTERN' | 'EASTERN';
  /** Other groups of the user, used to warn about duplicates and typos. */
  existingGroups?: { id: string; name: string; color?: string | null }[];
}

export default function GroupForm({
  group,
  mode,
  availablePeople = [],
  nameOrder,
  existingGroups = [],
}: GroupFormProps) {
  const t = useTranslations('groups.form');
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: group?.name || '',
    description: group?.description || '',
    color: group?.color || pickFreshColor(existingGroups.map((g) => g.color)),
  });

  // State for selected people (only used in create mode)
  const [selectedPeople, setSelectedPeople] = useState<{ id: string; label: string }[]>([]);

  const similarGroup = useMemo(
    () =>
      findSimilarName(
        formData.name,
        existingGroups.filter((g) => g.id !== group?.id),
        (g) => g.name
      ),
    [formData.name, existingGroups, group?.id]
  );

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const url = mode === 'create' ? '/api/groups' : `/api/groups/${group?.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      // Include peopleIds when creating a group
      const payload = mode === 'create'
        ? { ...formData, peopleIds: selectedPeople.map(p => p.id) }
        : formData;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t('errorSomethingWrong'));
        return;
      }

      // Show success toast
      toast.success(
        mode === 'create'
          ? t('successCreated', { name: formData.name })
          : t('successUpdated', { name: formData.name })
      );

      // Redirect to detail page after edit, list page after create
      if (mode === 'edit' && group?.id) {
        router.push(`/groups/${group.id}`);
      } else {
        router.push('/groups');
      }
      router.refresh();
    } catch {
      setError(t('errorConnection'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-warning/10 border border-warning/30 text-warning px-4 py-3 rounded" role="alert">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-muted mb-1"
        >
          {t('groupNameRequired')}
        </label>
        <input
          type="text"
          id="name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder={t('groupNamePlaceholder')}
          autoFocus={mode === 'create'}
          autoComplete="off"
          enterKeyHint="done"
        />
        {similarGroup && (
          <p role="status" className="text-xs text-warning mt-1">
            {similarGroup.exact
              ? t('nameExists', { name: similarGroup.item.name })
              : t('nameSimilar', { name: similarGroup.item.name })}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-muted mb-1"
        >
          {t('description')}
        </label>
        <textarea
          id="description"
          rows={2}
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder={t('descriptionPlaceholder')}
        />
      </div>

      <ColorPicker
        value={formData.color}
        onChange={(color) => setFormData({ ...formData, color })}
        label={t('color')}
        customLabel={t('customColor')}
        randomLabel={t('generateRandomColor')}
      />

      {/* People selector - only shown when creating a new group */}
      {mode === 'create' && availablePeople.length > 0 && (
        <div>
          <PillSelector
            label={t('addPeople')}
            selectedItems={selectedPeople}
            availableItems={availablePeople.map(person => ({
              id: person.id,
              label: formatFullName(person, nameOrder),
            }))}
            onAdd={(item) => setSelectedPeople([...selectedPeople, item])}
            onRemove={(itemId) => setSelectedPeople(selectedPeople.filter(p => p.id !== itemId))}
            placeholder={t('addPeoplePlaceholder')}
            emptyMessage={t('noPeopleFound')}
            helpText={t('addPeopleHelp')}
            isLoading={isLoading}
          />
        </div>
      )}

      <div className="flex justify-end space-x-4 pt-4">
        <Button variant="secondary" href="/groups">
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading
            ? t('saving')
            : mode === 'create'
            ? t('createGroup')
            : t('updateGroup')}
        </Button>
      </div>
    </form>
  );
}
