'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CustomFieldType } from '@prisma/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import {
  CUSTOM_FIELD_EXAMPLES,
  prefillFromExample,
  type CustomFieldPrefill,
} from './customFieldExamples';
import CustomFieldTemplateRow from './CustomFieldTemplateRow';
import CustomFieldTemplateForm from './CustomFieldTemplateForm';
import DeleteCustomFieldDialog from './DeleteCustomFieldDialog';

export interface TemplateWithCount {
  id: string;
  name: string;
  slug: string;
  type: CustomFieldType;
  options: string[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  _count: { values: number };
}

interface UsageResult {
  allowed: boolean;
  current: number;
  limit: number;
  isUnlimited: boolean;
}

interface CustomFieldsManagerProps {
  initialTemplates: TemplateWithCount[];
  usage: UsageResult | null;
}

type Mode =
  | { kind: 'idle' }
  | { kind: 'create'; prefill?: CustomFieldPrefill }
  | { kind: 'edit'; id: string }
  | { kind: 'delete'; id: string };

export default function CustomFieldsManager({
  initialTemplates,
  usage,
}: CustomFieldsManagerProps) {
  const t = useTranslations('customFields.settings');
  const tErrors = useTranslations('customFields.errors');
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateWithCount[]>(initialTemplates);
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  // Re-sync local state whenever the server-refreshed prop changes (after
  // create/edit/delete/reorder router.refresh() lands new data).
  useEffect(() => {
    setTemplates(initialTemplates);
  }, [initialTemplates]);

  const canCreate = usage === null || usage.allowed;

  const handleSaved = () => {
    setMode({ kind: 'idle' });
    toast.success(t('savedToast'));
    router.refresh();
  };

  const handleDeleted = () => {
    setMode({ kind: 'idle' });
    toast.success(t('deletedToast'));
    router.refresh();
  };

  const startFromExample = (id: (typeof CUSTOM_FIELD_EXAMPLES)[number]['id']) => {
    const example = CUSTOM_FIELD_EXAMPLES.find((candidate) => candidate.id === id);
    if (!example) return;
    setMode({ kind: 'create', prefill: prefillFromExample(example, (key) => t(key)) });
  };

  const exampleChips = (
    <div>
      <p className="text-sm font-medium text-foreground mb-2">{t('examples.title')}</p>
      <div className="flex flex-wrap gap-2">
        {CUSTOM_FIELD_EXAMPLES.map((example) => (
          <button
            key={example.id}
            type="button"
            onClick={() => startFromExample(example.id)}
            disabled={!canCreate}
            className="inline-flex items-center min-h-11 sm:min-h-0 px-3 py-1.5 rounded-full border border-border bg-surface text-sm text-foreground hover:border-primary/50 hover:bg-surface-elevated transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t(`examples.items.${example.id}.name`)}
          </button>
        ))}
      </div>
    </div>
  );

  const handleCancel = () => {
    setMode({ kind: 'idle' });
  };

  const handleMoveUp = async (id: string) => {
    const idx = templates.findIndex((t) => t.id === id);
    if (idx <= 0) return;
    const newOrder = [...templates];
    [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
    setTemplates(newOrder);
    await submitReorder(newOrder.map((t) => t.id));
  };

  const handleMoveDown = async (id: string) => {
    const idx = templates.findIndex((t) => t.id === id);
    if (idx < 0 || idx >= templates.length - 1) return;
    const newOrder = [...templates];
    [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
    setTemplates(newOrder);
    await submitReorder(newOrder.map((t) => t.id));
  };

  const submitReorder = async (ids: string[]) => {
    setReorderError(null);
    setIsReordering(true);
    try {
      const res = await fetch('/api/custom-field-templates/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setReorderError(data.error ?? tErrors('reorderFailed'));
      } else {
        router.refresh();
      }
    } catch {
      setReorderError(tErrors('reorderFailed'));
    } finally {
      setIsReordering(false);
    }
  };

  const templateBeingDeleted =
    mode.kind === 'delete' ? templates.find((t) => t.id === mode.id) : undefined;

  return (
    <div className="space-y-4">
      {/* Usage meter */}
      {usage !== null && (
        <p className="text-sm text-muted">
          {usage.isUnlimited
            ? t('usageMeterUnlimited', { used: usage.current })
            : t('usageMeter', { used: usage.current, limit: usage.limit })}
        </p>
      )}

      {/* New field button */}
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => setMode({ kind: 'create' })}
          disabled={!canCreate || mode.kind === 'create'}
          className="gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('newButton')}
        </Button>
      </div>

      {/* Inline create form */}
      {mode.kind === 'create' && (
        <div className="border border-border rounded-lg p-4 bg-surface-elevated space-y-4">
          {!mode.prefill && exampleChips}
          <CustomFieldTemplateForm
            key={mode.prefill ? `example-${mode.prefill.name}` : 'blank'}
            mode="create"
            initial={mode.prefill}
            onSaved={handleSaved}
            onCancel={handleCancel}
          />
        </div>
      )}

      {/* Reorder error */}
      {reorderError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{reorderError}</p>
      )}

      {/* Template list */}
      {templates.length === 0 && mode.kind !== 'create' ? (
        <div className="text-center py-12 text-muted">
          <svg
            className="w-12 h-12 mx-auto mb-4 opacity-40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
          <p className="font-medium">{t('emptyTitle')}</p>
          <p className="text-sm mt-1">{t('emptyDescription')}</p>
          <div className="mt-6 text-left max-w-xl mx-auto">{exampleChips}</div>
        </div>
      ) : (
        <>
        {templates.length > 1 && <p className="text-sm text-muted">{t('orderHint')}</p>}
        <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
          {templates.map((template, idx) => (
            <li key={template.id}>
              <CustomFieldTemplateRow
                template={template}
                isEditing={mode.kind === 'edit' && mode.id === template.id}
                canMoveUp={idx > 0 && !isReordering}
                canMoveDown={idx < templates.length - 1 && !isReordering}
                onEdit={() => setMode({ kind: 'edit', id: template.id })}
                onDelete={() => setMode({ kind: 'delete', id: template.id })}
                onMoveUp={() => handleMoveUp(template.id)}
                onMoveDown={() => handleMoveDown(template.id)}
                onSaved={handleSaved}
                onCancel={handleCancel}
              />
            </li>
          ))}
        </ul>
        </>
      )}

      {/* Delete dialog */}
      {mode.kind === 'delete' && templateBeingDeleted && (
        <DeleteCustomFieldDialog
          template={templateBeingDeleted}
          onConfirm={handleDeleted}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
