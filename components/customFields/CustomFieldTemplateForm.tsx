'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CustomFieldType } from '@prisma/client';
import { TemplateWithCount } from './CustomFieldsManager';
import { Button } from '@/components/ui/Button';
import type { CustomFieldPrefill } from './customFieldExamples';

interface CustomFieldTemplateFormProps {
  mode: 'create' | 'edit';
  template?: TemplateWithCount;
  /** Starting values for a new field, for example from an example chip. */
  initial?: CustomFieldPrefill;
  onSaved: () => void;
  onCancel: () => void;
}

const FIELD_TYPES: CustomFieldType[] = ['TEXT', 'NUMBER', 'BOOLEAN', 'SELECT'];

const TYPE_LABEL_KEYS: Record<CustomFieldType, string> = {
  TEXT: 'typeText',
  NUMBER: 'typeNumber',
  BOOLEAN: 'typeBoolean',
  SELECT: 'typeSelect',
};

export default function CustomFieldTemplateForm({
  mode,
  template,
  initial,
  onSaved,
  onCancel,
}: CustomFieldTemplateFormProps) {
  const t = useTranslations('customFields.form');
  const tErrors = useTranslations('customFields.errors');

  const [name, setName] = useState(template?.name ?? initial?.name ?? '');
  const [type, setType] = useState<CustomFieldType>(template?.type ?? initial?.type ?? 'TEXT');
  const [options, setOptions] = useState<string[]>(
    template?.options.length ? template.options : initial?.options.length ? initial.options : ['']
  );
  const [nameError, setNameError] = useState<string | null>(null);
  // Index of an option input that should take focus after it was just added.
  const [focusOption, setFocusOption] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = mode === 'edit';
  const showOptions = type === 'SELECT';

  const handleOptionChange = (idx: number, value: string) => {
    const next = [...options];
    next[idx] = value;
    setOptions(next);
  };

  const handleAddOption = () => {
    setOptions([...options, '']);
    setFocusOption(options.length);
  };

  const handleRemoveOption = (idx: number) => {
    setOptions(options.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setNameError(null);

    const payload =
      type === 'SELECT'
        ? { name, type, options: options.filter((o) => o.trim() !== '') }
        : { name, type, options: [] };

    try {
      const url = isEdit
        ? `/api/custom-field-templates/${template!.id}`
        : '/api/custom-field-templates';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onSaved();
      } else {
        const data = (await res.json()) as { error?: string };
        // Map known statuses to translated strings; fall back to the API's
        // raw message for cases we haven't mapped (already English-only).
        if (res.status === 409) {
          setNameError(tErrors('duplicateName'));
        } else {
          setError(data.error ?? tErrors('somethingWentWrong'));
        }
      }
    } catch {
      setError(tErrors('cannotConnect'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label htmlFor="cf-name" className="block text-sm font-medium text-foreground mb-1">
          {t('nameLabel')}
        </label>
        <input
          id="cf-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError(null);
          }}
          placeholder={t('namePlaceholder')}
          maxLength={60}
          required
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? 'cf-name-error' : undefined}
          className="w-full min-h-11 rounded-lg border border-border bg-surface text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        {nameError && <p id="cf-name-error" className="mt-1 text-sm text-warning">{nameError}</p>}
      </div>

      {/* Type */}
      <div>
        <span className="block text-sm font-medium text-foreground mb-2">{t('typeLabel')}</span>
        {isEdit && (
          <p className="text-xs text-muted mb-2">{t('typeLockedNotice')}</p>
        )}
        <div className="flex flex-wrap gap-3">
          {FIELD_TYPES.map((ft) => (
            <label
              key={ft}
              className={`inline-flex items-center gap-2 min-h-11 cursor-pointer ${
                isEdit ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <input
                type="radio"
                name="cf-type"
                value={ft}
                checked={type === ft}
                onChange={() => !isEdit && setType(ft)}
                disabled={isEdit}
                className="text-primary focus:ring-primary"
              />
              <span className="text-sm text-foreground">{t(TYPE_LABEL_KEYS[ft])}</span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-sm text-muted">{t(`typeHint.${type}`)}</p>
      </div>

      {/* Options (SELECT only) */}
      {showOptions && (
        <div>
          <span className="block text-sm font-medium text-foreground mb-2">
            {t('optionsLabel')}
          </span>
          <div className="space-y-2">
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  onKeyDown={(e) => {
                    // Enter adds the next option instead of submitting the form.
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (opt.trim() !== '') handleAddOption();
                    }
                  }}
                  autoFocus={focusOption === idx}
                  placeholder={`${t('optionPlaceholder')} ${idx + 1}`}
                  className="flex-1 min-h-11 rounded-lg border border-border bg-surface text-foreground px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                {options.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(idx)}
                    className="min-h-11 px-2 text-sm text-muted hover:text-red-600 dark:hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    {t('removeOption')}
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddOption}
            className="mt-1 min-h-11 text-sm text-primary hover:underline"
          >
            + {t('addOption')}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Buttons */}
      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? t('savingButton') : t('saveButton')}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
          {t('cancelButton')}
        </Button>
      </div>
    </form>
  );
}
