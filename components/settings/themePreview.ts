import type { Theme } from '@/lib/theme-colors';

export interface ThemePreviewColors {
  background: string;
  surface: string;
  foreground: string;
  muted: string;
  border: string;
  primary: string;
}

/**
 * The palette of each theme, for the little preview cards. A preview has to
 * show the theme that is NOT active, which CSS variables cannot do, so the
 * values are copied here. tests/components/settings/themePreview.test.tsx
 * reads app/globals.css and fails if they drift apart.
 */
export const THEME_PREVIEW_COLORS: Record<Theme, ThemePreviewColors> = {
  LIGHT: {
    background: '#F7F6F3',
    surface: '#FFFFFF',
    foreground: '#1C1917',
    muted: 'rgba(28, 25, 23, 0.63)',
    border: 'rgba(28, 25, 23, 0.1)',
    primary: '#2563EB',
  },
  DARK: {
    background: '#121110',
    surface: '#1C1A17',
    foreground: '#EDE9E1',
    muted: 'rgba(237, 233, 225, 0.6)',
    border: 'rgba(237, 233, 225, 0.1)',
    primary: '#60A5FA',
  },
};
