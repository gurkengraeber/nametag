'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

interface SettingsSaveBarProps {
  dirty: boolean;
  isSaving: boolean;
  saveLabel: string;
  savingLabel: string;
  /** Resets the form to its saved values. Omit to hide the discard button. */
  onDiscard?: () => void;
  /** Show "All changes saved" while clean. Turn off for forms that start empty. */
  showIdleStatus?: boolean;
}

/**
 * The bottom row of a form that saves with a button. It says plainly whether
 * there is anything to save, so nobody has to wonder whether a change counted.
 */
export default function SettingsSaveBar({
  dirty,
  isSaving,
  saveLabel,
  savingLabel,
  onDiscard,
  showIdleStatus = true,
}: SettingsSaveBarProps) {
  const t = useTranslations('settings.unsaved');

  return (
    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-4">
      <p
        className={`text-sm sm:mr-auto ${dirty ? 'text-foreground' : 'text-muted'}`}
        role="status"
      >
        {dirty ? t('indicator') : showIdleStatus ? t('allSaved') : ''}
      </p>
      {dirty && onDiscard && (
        <Button type="button" variant="secondary" onClick={onDiscard} disabled={isSaving}>
          {t('discard')}
        </Button>
      )}
      <Button type="submit" disabled={isSaving || !dirty}>
        {isSaving ? savingLabel : saveLabel}
      </Button>
    </div>
  );
}
