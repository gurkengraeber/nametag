'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import PersonAutocomplete from '../PersonAutocomplete';
import type { FormData } from '../../hooks/usePersonForm';

interface AvailablePerson {
  id: string;
  name: string;
  surname: string | null;
  middleName: string | null;
  secondLastName: string | null;
  nickname: string | null;
  groups: Array<{ groupId: string }>;
}

interface RelationshipType {
  id: string;
  label: string;
  color: string | null;
}

interface PersonalInfoSectionProps {
  mode: 'create' | 'edit';
  /** Already translated messages keyed by field id (name, surname, ...). */
  errors?: Record<string, string>;
  autoFocusName?: boolean;
  formData: FormData;
  onFormDataChange: (updates: Partial<FormData>) => void;
  knownThroughId: string;
  knownThroughName: string;
  onKnownThroughChange: (id: string, name: string) => void;
  peopleWithUser: AvailablePerson[];
  relationshipTypes: RelationshipType[];
  nameOrder?: 'WESTERN' | 'EASTERN';
}

const inputClass =
  'w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

import TooltipIcon from '@/components/ui/TooltipIcon';

interface TextFieldProps {
  id: keyof Pick<
    FormData,
    | 'prefix'
    | 'name'
    | 'middleName'
    | 'surname'
    | 'secondLastName'
    | 'nickname'
    | 'suffix'
  >;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

// Defined outside the section so typing does not remount the inputs.
function TextField({
  id,
  label,
  value,
  onChange,
  error,
  required,
  placeholder,
  inputRef,
}: TextFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-muted mb-1">
        {label}
      </label>
      <input
        ref={inputRef}
        type="text"
        id={id}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize="words"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClass}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-warning mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

export default function PersonalInfoSection({
  mode,
  errors = {},
  autoFocusName = false,
  formData,
  onFormDataChange,
  knownThroughId,
  knownThroughName,
  onKnownThroughChange,
  peopleWithUser,
  relationshipTypes,
  nameOrder,
}: PersonalInfoSectionProps) {
  const t = useTranslations('people.form');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [showMoreNames, setShowMoreNames] = useState(
    () =>
      !!(
        formData.prefix ||
        formData.middleName ||
        formData.secondLastName ||
        formData.suffix ||
        formData.displayNameOverride
      )
  );

  useEffect(() => {
    if (autoFocusName) nameInputRef.current?.focus();
  }, [autoFocusName]);

  const moreNamesId = useId();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField
          id="name"
          label={t('nameRequired')}
          value={formData.name}
          onChange={(name) => onFormDataChange({ name })}
          error={errors.name}
          required
          inputRef={nameInputRef}
        />
        <TextField
          id="surname"
          label={t('surnameLabel')}
          value={formData.surname}
          onChange={(surname) => onFormDataChange({ surname })}
          error={errors.surname}
        />
        <TextField
          id="nickname"
          label={t('nicknameLabel')}
          value={formData.nickname}
          onChange={(nickname) => onFormDataChange({ nickname })}
          error={errors.nickname}
        />
      </div>

      {mode === 'create' && (
        <div>
          <label
            htmlFor="knownThrough"
            className="block text-sm font-medium text-muted mb-1"
          >
            {t('knownThroughLabel')}
          </label>
          <PersonAutocomplete
            people={peopleWithUser}
            value={knownThroughId}
            onChange={onKnownThroughChange}
            placeholder={t('searchForPerson')}
            nameOrder={nameOrder}
          />
          <p className="text-xs text-muted mt-1">{t('knownThroughHelp')}</p>
        </div>
      )}

      {mode === 'edit' && (
        <div>
          <label
            htmlFor="relationshipToUserId"
            className="flex items-center gap-1.5 text-sm font-medium text-muted mb-1"
          >
            {t('relationshipToYouDirect')}
            <TooltipIcon tooltip={t('relationshipToYouTooltip')} />
          </label>
          <select
            id="relationshipToUserId"
            value={formData.relationshipToUserId}
            onChange={(e) =>
              onFormDataChange({ relationshipToUserId: e.target.value })
            }
            className={inputClass}
          >
            <option value="">{t('selectRelationship')}</option>
            {relationshipTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
          {errors.relationshipToUserId && (
            <p className="text-sm text-warning mt-1">{errors.relationshipToUserId}</p>
          )}
        </div>
      )}

      {mode === 'create' && knownThroughId === 'user' && (
        <div>
          <label
            htmlFor="relationshipToUserId"
            className="flex items-center gap-1.5 text-sm font-medium text-muted mb-1"
          >
            {t('relationshipToYouDirect')} *
            <TooltipIcon tooltip={t('relationshipToYouTooltip')} />
          </label>
          <select
            id="relationshipToUserId"
            required
            value={formData.relationshipToUserId}
            onChange={(e) =>
              onFormDataChange({ relationshipToUserId: e.target.value })
            }
            className={inputClass}
          >
            <option value="">{t('selectRelationship')}</option>
            {relationshipTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
          {errors.relationshipToUserId && (
            <p className="text-sm text-warning mt-1">{errors.relationshipToUserId}</p>
          )}
        </div>
      )}

      {mode === 'create' && knownThroughId !== 'user' && (
        <div>
          <label
            htmlFor="relationshipToKnownThrough"
            className="flex items-center gap-1.5 text-sm font-medium text-muted mb-1"
          >
            {t('relationshipToRequired', { name: knownThroughName })}
            <TooltipIcon tooltip={t('relationshipToYouTooltip')} />
          </label>
          <select
            id="relationshipToKnownThrough"
            required
            value={formData.relationshipToUserId}
            onChange={(e) =>
              onFormDataChange({ relationshipToUserId: e.target.value })
            }
            className={inputClass}
          >
            <option value="">{t('selectRelationship')}</option>
            {relationshipTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
          {errors.relationshipToUserId && (
            <p className="text-sm text-warning mt-1">{errors.relationshipToUserId}</p>
          )}
          <p className="text-xs text-muted mt-1">
            {t('willBeConnectedTo', { name: knownThroughName })}
          </p>
        </div>
      )}

      <div>
        <button
          type="button"
          aria-expanded={showMoreNames}
          aria-controls={moreNamesId}
          onClick={() => setShowMoreNames(!showMoreNames)}
          className="inline-flex items-center gap-1.5 min-h-11 sm:min-h-0 text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showMoreNames ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {t('moreNameFields')}
        </button>
        <div
          id={moreNamesId}
          hidden={!showMoreNames}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3"
        >
          <TextField
            id="prefix"
            label={t('prefixLabel')}
            value={formData.prefix}
            onChange={(prefix) => onFormDataChange({ prefix })}
            placeholder={t('prefixPlaceholder')}
            error={errors.prefix}
          />
          <TextField
            id="middleName"
            label={t('middleNameLabel')}
            value={formData.middleName}
            onChange={(middleName) => onFormDataChange({ middleName })}
            error={errors.middleName}
          />
          <TextField
            id="secondLastName"
            label={t('secondLastNameLabel')}
            value={formData.secondLastName}
            onChange={(secondLastName) => onFormDataChange({ secondLastName })}
            error={errors.secondLastName}
          />
          <TextField
            id="suffix"
            label={t('suffixLabel')}
            value={formData.suffix}
            onChange={(suffix) => onFormDataChange({ suffix })}
            placeholder={t('suffixPlaceholder')}
            error={errors.suffix}
          />

          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="displayNameOverride"
                className="block text-sm font-medium text-muted"
              >
                {t('displayNameOverrideLabel')}
              </label>
              {formData.nickname && !formData.displayNameOverride && (
                <button
                  type="button"
                  onClick={() =>
                    onFormDataChange({ displayNameOverride: formData.nickname })
                  }
                  className="text-xs text-primary hover:underline"
                >
                  {t('displayNameOverrideUseNickname')}
                </button>
              )}
            </div>
            <input
              type="text"
              id="displayNameOverride"
              value={formData.displayNameOverride}
              onChange={(e) =>
                onFormDataChange({ displayNameOverride: e.target.value })
              }
              placeholder={t('displayNameOverridePlaceholder')}
              className={inputClass}
              maxLength={200}
              aria-invalid={errors.displayNameOverride ? true : undefined}
            />
            {errors.displayNameOverride && (
              <p className="text-sm text-warning mt-1">{errors.displayNameOverride}</p>
            )}
            <p className="text-xs text-muted mt-1">
              {t('displayNameOverrideHelp')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
