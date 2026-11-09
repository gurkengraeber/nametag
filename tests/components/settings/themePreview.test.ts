import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { THEME_PREVIEW_COLORS } from '@/components/settings/themePreview';

/** Reads one custom property out of a top level block of app/globals.css. */
function variableFor(selector: string, name: string): string {
  const css = readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf8');
  const start = css.indexOf(`\n${selector} {`);
  if (start === -1) throw new Error(`No "${selector} {" block in app/globals.css`);
  const end = css.indexOf('\n}', start);
  const match = new RegExp(`${name}:\\s*([^;]+);`).exec(css.slice(start, end));
  if (!match) throw new Error(`No ${name} inside ${selector}`);
  return match[1].trim().toLowerCase();
}

describe('THEME_PREVIEW_COLORS matches globals.css', () => {
  const cases = [
    ['LIGHT', ':root'],
    ['DARK', '.dark'],
  ] as const;

  for (const [theme, selector] of cases) {
    it(`uses the ${selector} palette for ${theme}`, () => {
      const colors = THEME_PREVIEW_COLORS[theme];
      expect(colors.background.toLowerCase()).toBe(variableFor(selector, '--background'));
      expect(colors.surface.toLowerCase()).toBe(variableFor(selector, '--surface'));
      expect(colors.foreground.toLowerCase()).toBe(variableFor(selector, '--foreground'));
      expect(colors.primary.toLowerCase()).toBe(variableFor(selector, '--primary'));
      expect(colors.muted.toLowerCase()).toBe(variableFor(selector, '--muted'));
      expect(colors.border.toLowerCase()).toBe(variableFor(selector, '--border'));
    });
  }
});
