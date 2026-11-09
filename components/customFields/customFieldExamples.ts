import type { CustomFieldType } from '@prisma/client';

/**
 * Starting points offered when creating a custom field. Names and option texts
 * live in locales/*.json under customFields.examples.items.<id>, so the
 * suggestions read naturally in every language.
 */
export interface CustomFieldExample {
  id: 'diet' | 'allergies' | 'pets' | 'shoeSize' | 'giftIdeas';
  type: CustomFieldType;
  /** How many option texts (option1, option2, ...) the locale file holds. */
  optionCount: number;
}

export const CUSTOM_FIELD_EXAMPLES: CustomFieldExample[] = [
  { id: 'diet', type: 'SELECT', optionCount: 3 },
  { id: 'allergies', type: 'TEXT', optionCount: 0 },
  { id: 'pets', type: 'BOOLEAN', optionCount: 0 },
  { id: 'shoeSize', type: 'NUMBER', optionCount: 0 },
  { id: 'giftIdeas', type: 'TEXT', optionCount: 0 },
];

export interface CustomFieldPrefill {
  name: string;
  type: CustomFieldType;
  options: string[];
}

/** Turns an example into form values using a translate function for its texts. */
export function prefillFromExample(
  example: CustomFieldExample,
  translate: (key: string) => string
): CustomFieldPrefill {
  const base = `examples.items.${example.id}`;
  const options: string[] = [];
  for (let index = 1; index <= example.optionCount; index += 1) {
    options.push(translate(`${base}.option${index}`));
  }
  return { name: translate(`${base}.name`), type: example.type, options };
}
