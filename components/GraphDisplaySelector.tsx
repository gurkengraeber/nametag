'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import OptionCardGroup from '@/components/settings/OptionCardGroup';
import { saveSetting } from '@/components/settings/saveSetting';

type Mode = 'individuals' | 'bubbles';

interface Props {
  currentMode: Mode;
}

export default function GraphDisplaySelector({ currentMode }: Props) {
  const t = useTranslations('settings.appearance');
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(currentMode);
  const [isLoading, setIsLoading] = useState(false);

  const handleMode = async (next: Mode) => {
    const previous = mode;
    setMode(next);
    setIsLoading(true);

    const result = await saveSetting('/api/user/graph-display', { graphMode: next });
    setIsLoading(false);

    if (!result.ok) {
      setMode(previous);
      toast.error(result.error ?? t('graphDisplayError'));
      return;
    }
    toast.success(t('graphDisplaySuccess'));
    router.refresh();
  };

  return (
    <OptionCardGroup<Mode>
      label={t('graphModeTitle')}
      value={mode}
      onChange={handleMode}
      disabled={isLoading}
      options={[
        { value: 'individuals', label: t('graphModeIndividuals') },
        { value: 'bubbles', label: t('graphModeBubbles') },
      ]}
    />
  );
}
