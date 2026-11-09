'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useTheme } from './ThemeProvider';
import OptionCardGroup from '@/components/settings/OptionCardGroup';
import { saveSetting } from '@/components/settings/saveSetting';
import { THEME_PREVIEW_COLORS } from '@/components/settings/themePreview';
import type { Theme } from '@/lib/theme-colors';

interface ThemeToggleProps {
  userId: string;
  currentTheme: Theme;
}

/** A tiny mock of a screen in the given theme, so the choice can be judged before making it. */
function ThemePreview({ theme }: { theme: Theme }) {
  const colors = THEME_PREVIEW_COLORS[theme];
  return (
    <div
      aria-hidden="true"
      className="rounded-md p-2"
      style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}
    >
      <div
        className="rounded px-2 py-2"
        style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
      >
        <div className="h-2 w-16 rounded" style={{ backgroundColor: colors.foreground }} />
        <div className="h-1.5 w-24 rounded mt-1.5" style={{ backgroundColor: colors.muted }} />
        <div className="h-4 w-12 rounded mt-2" style={{ backgroundColor: colors.primary }} />
      </div>
    </div>
  );
}

export default function ThemeToggle({}: ThemeToggleProps) {
  const t = useTranslations('settings.appearance');
  const { theme, setTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = async (next: Theme) => {
    if (isLoading) return;
    const previous = theme;

    // Applied at once so the page itself is the preview; undone if saving fails.
    setTheme(next);
    setIsLoading(true);

    const result = await saveSetting('/api/user/theme', { theme: next });
    setIsLoading(false);

    if (!result.ok) {
      setTheme(previous);
      toast.error(t('themeError'));
      return;
    }
    toast.success(t('themeSuccess'));
  };

  return (
    <OptionCardGroup<Theme>
      label={t('themePreferredLabel')}
      value={theme}
      onChange={handleChange}
      disabled={isLoading}
      columns={2}
      options={[
        { value: 'DARK', label: t('themeDarkLabel'), preview: <ThemePreview theme="DARK" /> },
        { value: 'LIGHT', label: t('themeLightLabel'), preview: <ThemePreview theme="LIGHT" /> },
      ]}
    />
  );
}
