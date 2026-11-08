import { describe, it, expect } from 'vitest';
import { buildNamePreview } from '@/components/settings/namePreview';

describe('buildNamePreview', () => {
  it('shows every part in Western order for the full format', () => {
    expect(buildNamePreview('WESTERN', 'FULL')).toEqual({
      page: "Maria 'Mia' Garcia",
      compact: "Maria 'Mia' Garcia",
    });
  });

  it('puts the family name first in Eastern order', () => {
    expect(buildNamePreview('EASTERN', 'FULL').page).toBe("Garcia 'Mia' Maria");
  });

  it('replaces the first name by the nickname in lists when preferred', () => {
    const preview = buildNamePreview('WESTERN', 'NICKNAME_PREFERRED');
    expect(preview.compact).toBe('Mia Garcia');
    expect(preview.page).toBe("Maria 'Mia' Garcia");
  });

  it('shortens to the nickname', () => {
    expect(buildNamePreview('WESTERN', 'SHORT')).toEqual({ page: 'Mia', compact: 'Mia' });
  });
});
