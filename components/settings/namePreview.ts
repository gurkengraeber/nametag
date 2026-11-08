import { formatFullName, formatGraphName, type NameDisplayFormat } from '@/lib/nameUtils';

export type NameOrder = 'WESTERN' | 'EASTERN';

/** An invented person, so the preview never shows anyone's real data. */
export const PREVIEW_PERSON = {
  name: 'Maria',
  surname: 'Garcia',
  nickname: 'Mia',
} as const;

export interface NamePreview {
  /** How the name reads on a person's own page. */
  page: string;
  /** How it reads in lists and the network graph. */
  compact: string;
}

/** Builds the live "this is what a name looks like" example from the two name settings. */
export function buildNamePreview(order: NameOrder, format: NameDisplayFormat): NamePreview {
  return {
    page: formatFullName(PREVIEW_PERSON, order, format),
    compact: formatGraphName(PREVIEW_PERSON, order, format),
  };
}
