'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import OptionCardGroup from './OptionCardGroup';
import { saveSetting } from './saveSetting';
import { buildNamePreview, type NameOrder } from './namePreview';
import { clearNameOrderCache } from '@/lib/user-name-order';
import type { NameDisplayFormat } from '@/lib/nameUtils';

interface NameStyleSettingsProps {
  currentOrder: NameOrder;
  currentFormat: NameDisplayFormat;
}

/**
 * Name order and name format together, with an example that follows both. The
 * two used to be separate cards whose effect could only be seen by leaving the
 * page and looking at a real person.
 */
export default function NameStyleSettings({ currentOrder, currentFormat }: NameStyleSettingsProps) {
  const t = useTranslations('settings.appearance');
  const router = useRouter();
  const [order, setOrder] = useState(currentOrder);
  const [format, setFormat] = useState(currentFormat);
  const [isLoading, setIsLoading] = useState(false);

  const preview = buildNamePreview(order, format);

  const handleOrderChange = async (next: NameOrder) => {
    const previous = order;
    setOrder(next);
    setIsLoading(true);
    const result = await saveSetting('/api/user/name-order', { nameOrder: next });
    setIsLoading(false);
    if (!result.ok) {
      setOrder(previous);
      toast.error(result.error ?? t('nameOrderError'));
      return;
    }
    toast.success(t('nameOrderSuccess'));
    // Navigation search caches this for the life of the page, so drop it here.
    clearNameOrderCache();
    router.refresh();
  };

  const handleFormatChange = async (next: NameDisplayFormat) => {
    const previous = format;
    setFormat(next);
    setIsLoading(true);
    const result = await saveSetting('/api/user/name-display-format', { nameDisplayFormat: next });
    setIsLoading(false);
    if (!result.ok) {
      setFormat(previous);
      toast.error(result.error ?? t('nameDisplayFormatError'));
      return;
    }
    toast.success(t('nameDisplayFormatSuccess'));
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div
        className="bg-surface-elevated border border-border rounded-lg p-4"
        role="group"
        aria-labelledby="name-preview-title"
      >
        <h3 id="name-preview-title" className="text-sm font-medium text-muted mb-3">
          {t('namePreview.title')}
        </h3>
        <dl className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
            <dt className="text-sm text-muted sm:w-48 flex-shrink-0">{t('namePreview.page')}</dt>
            <dd className="text-lg font-medium text-foreground" data-testid="name-preview-page">{preview.page}</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
            <dt className="text-sm text-muted sm:w-48 flex-shrink-0">{t('namePreview.compact')}</dt>
            <dd className="text-lg font-medium text-foreground" data-testid="name-preview-compact">{preview.compact}</dd>
          </div>
        </dl>
      </div>

      <div>
        <h3 className="text-base font-semibold text-foreground mb-1">{t('nameOrderTitle')}</h3>
        <p className="text-sm text-muted mb-3">{t('nameOrderDescription')}</p>
        <OptionCardGroup<NameOrder>
          label={t('nameOrderTitle')}
          value={order}
          onChange={handleOrderChange}
          disabled={isLoading}
          options={[
            { value: 'WESTERN', label: t('nameOrderWestern'), description: t('nameOrderWesternDescription') },
            { value: 'EASTERN', label: t('nameOrderEastern'), description: t('nameOrderEasternDescription') },
          ]}
        />
      </div>

      <div>
        <h3 className="text-base font-semibold text-foreground mb-1">{t('nameDisplayFormatTitle')}</h3>
        <p className="text-sm text-muted mb-3">{t('nameDisplayFormatDescription')}</p>
        <OptionCardGroup<NameDisplayFormat>
          label={t('nameDisplayFormatTitle')}
          value={format}
          onChange={handleFormatChange}
          disabled={isLoading}
          options={[
            { value: 'FULL', label: t('nameDisplayFormatFull'), description: t('nameDisplayFormatFullDescription') },
            { value: 'NICKNAME_PREFERRED', label: t('nameDisplayFormatNicknamePreferred'), description: t('nameDisplayFormatNicknamePreferredDescription') },
            { value: 'SHORT', label: t('nameDisplayFormatShort'), description: t('nameDisplayFormatShortDescription') },
          ]}
        />
      </div>
    </div>
  );
}
