'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { getDateFormatExample } from '@/lib/date-format';
import OptionCardGroup from '@/components/settings/OptionCardGroup';
import { saveSetting } from '@/components/settings/saveSetting';

type DateFormatValue = 'MDY' | 'DMY' | 'YMD';

interface DateFormatSelectorProps {
  userId: string;
  currentFormat: DateFormatValue;
}

const FORMATS: Array<{ value: DateFormatValue; label: string }> = [
  { value: 'MDY', label: 'MM/DD/YYYY' },
  { value: 'DMY', label: 'DD/MM/YYYY' },
  { value: 'YMD', label: 'YYYY-MM-DD' },
];

export default function DateFormatSelector({ currentFormat }: DateFormatSelectorProps) {
  const t = useTranslations('settings.appearance');
  const router = useRouter();
  const [dateFormat, setDateFormat] = useState(currentFormat);
  const [isLoading, setIsLoading] = useState(false);

  const handleFormatChange = async (newFormat: DateFormatValue) => {
    const previous = dateFormat;
    setDateFormat(newFormat);
    setIsLoading(true);

    const result = await saveSetting('/api/user/date-format', { dateFormat: newFormat });
    setIsLoading(false);

    if (!result.ok) {
      setDateFormat(previous);
      toast.error(result.error ?? t('dateFormatError'));
      return;
    }
    toast.success(t('dateFormatSuccess'));
    router.refresh();
  };

  return (
    <div>
      <p className="text-sm text-muted mb-4">{t('dateFormatDescription')}</p>
      <OptionCardGroup<DateFormatValue>
        label={t('dateFormatTitle')}
        value={dateFormat}
        onChange={handleFormatChange}
        disabled={isLoading}
        options={FORMATS.map((format) => ({
          value: format.value,
          label: format.label,
          description: `${t('dateFormatExample')}: ${getDateFormatExample(format.value)}`,
        }))}
      />
    </div>
  );
}
