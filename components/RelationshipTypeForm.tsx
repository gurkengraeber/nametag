'use client';

import { useMemo, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import RelationshipTypeAutocomplete from './RelationshipTypeAutocomplete';
import { pickFreshColor } from '@/lib/color-choice';
import { findSimilarName } from '@/lib/name-similarity';
import ColorPicker from './ColorPicker';
import { Button } from './ui/Button';

interface RelationshipType {
  id: string;
  name: string;
  label: string;
  color: string | null;
  inverseId: string | null;
  inverse?: {
    id: string;
    name: string;
    label: string;
  } | null;
}

interface RelationshipTypeFormProps {
  relationshipType?: RelationshipType;
  availableTypes: RelationshipType[];
  mode: 'create' | 'edit';
}

export default function RelationshipTypeForm({
  relationshipType,
  availableTypes,
  mode,
}: RelationshipTypeFormProps) {
  const t = useTranslations('relationshipTypes.form');
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    label: relationshipType?.label || '',
    color: relationshipType?.color || pickFreshColor(availableTypes.map((type) => type.color)),
  });

  // Track inverse relationship
  const [inverseValue, setInverseValue] = useState(relationshipType?.inverseId || '');
  const [inverseIsExisting, setInverseIsExisting] = useState(!!relationshipType?.inverseId);
  const [inverseLabel, setInverseLabel] = useState(relationshipType?.inverse?.label || '');

  // Symmetric relationship toggle (inverse is the same as main, e.g., friend <-> friend)
  // New types start symmetric, because most custom ones (Neighbor, Teammate) are
  const isInitiallySymmetric =
    mode === 'create' || relationshipType?.inverseId === relationshipType?.id;
  const [isSymmetric, setIsSymmetric] = useState(isInitiallySymmetric);

  // Warn about an existing type with a (nearly) identical label
  const similarType = useMemo(
    () =>
      findSimilarName(
        formData.label,
        availableTypes.filter((type) => type.id !== relationshipType?.id),
        (type) => type.label
      ),
    [formData.label, availableTypes, relationshipType?.id]
  );

  // Live example that shows what the inverse means
  const exampleLabel = formData.label.trim() || t('exampleLabelFallback');
  const exampleInverse = inverseIsExisting
    ? availableTypes.find((type) => type.id === inverseValue)?.label ?? ''
    : (inverseLabel || inverseValue).trim();
  const example = isSymmetric
    ? t('exampleSymmetric', { label: exampleLabel })
    : exampleInverse
    ? t('exampleInverse', { label: exampleLabel, inverse: exampleInverse })
    : t('exampleNoInverse', { label: exampleLabel });

  // Sanitize label to create internal name
  const sanitizeName = (label: string): string => {
    return label
      .toUpperCase()
      .replace(/\s+/g, '_'); // Replace spaces with underscores
  };

  type RelationshipTypePayload = {
    label: string;
    color: string | null;
    name: string;
    symmetric?: true;
    inverseId?: string | null;
    inverseLabel?: string;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const url =
        mode === 'create'
          ? '/api/relationship-types'
          : `/api/relationship-types/${relationshipType?.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      // Generate internal name from label
      const name = sanitizeName(formData.label);

      // Prepare payload
      const payload: RelationshipTypePayload = {
        ...formData,
        name,
      };

      // Add inverse relationship data
      if (isSymmetric) {
        // Symmetric relationship - inverse is the same as main (e.g., friend <-> friend)
        payload.symmetric = true;
      } else if (inverseValue) {
        if (inverseIsExisting) {
          // Existing type - send ID
          payload.inverseId = inverseValue;
        } else {
          // New type - send label to create
          payload.inverseLabel = inverseLabel || inverseValue;
        }
      } else {
        payload.inverseId = null;
      }

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
          ? t('successCreated', { label: formData.label })
          : t('successUpdated', { label: formData.label })
      );

      router.push('/relationship-types');
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
        <div role="alert" className="bg-warning/10 border border-warning/30 text-warning px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="label"
          className="block text-sm font-medium text-muted mb-1"
        >
          {t('labelRequired')}
        </label>
        <input
          type="text"
          id="label"
          required
          value={formData.label}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
          className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder={t('labelPlaceholder')}
          autoFocus={mode === 'create'}
          autoComplete="off"
          enterKeyHint="next"
        />
        {similarType ? (
          <p role="status" className="text-xs text-warning mt-1">
            {similarType.exact
              ? t('labelExists', { label: similarType.item.label })
              : t('labelSimilar', { label: similarType.item.label })}
          </p>
        ) : (
          <p className="text-xs text-muted mt-1">
            {t('labelHelp')}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-muted mb-2">
          {t('inverseRelationship')}
        </label>

        {/* Symmetric toggle */}
        <div className="flex items-center mb-3 min-h-11 sm:min-h-0">
          <button
            type="button"
            role="switch"
            aria-checked={isSymmetric}
            onClick={() => {
              setIsSymmetric(!isSymmetric);
              if (!isSymmetric) {
                // When enabling symmetric, clear the inverse value
                setInverseValue('');
                setInverseIsExisting(false);
                setInverseLabel('');
              }
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
              isSymmetric ? 'bg-primary' : 'bg-surface-elevated'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isSymmetric ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <span className="ml-3 text-sm text-muted">
            {t('symmetric')}
          </span>
        </div>
        <p className="text-xs text-muted mb-1">{t('inverseIntro')}</p>
        <p className="text-xs text-foreground mb-3" aria-live="polite">
          {example}
        </p>

        {/* Inverse autocomplete - only shown when not symmetric */}
        {!isSymmetric && (
          <RelationshipTypeAutocomplete
            types={availableTypes}
            value={inverseValue}
            isExisting={inverseIsExisting}
            onChange={(value, isExisting, label) => {
              setInverseValue(value);
              setInverseIsExisting(isExisting);
              setInverseLabel(label);
            }}
            placeholder={t('inversePlaceholder')}
          />
        )}
      </div>

      <ColorPicker
        value={formData.color}
        onChange={(color) => setFormData({ ...formData, color })}
        label={t('color')}
        customLabel={t('customColor')}
        randomLabel={t('generateRandomColor')}
      />

      <div className="flex justify-end space-x-4 pt-4">
        <Button variant="secondary" href="/relationship-types">
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading
            ? t('saving')
            : mode === 'create'
            ? t('createType')
            : t('updateType')}
        </Button>
      </div>
    </form>
  );
}
