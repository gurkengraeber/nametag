import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '@/locales/en.json';
import CustomFieldsManager from '@/components/customFields/CustomFieldsManager';
import { CUSTOM_FIELD_EXAMPLES, prefillFromExample } from '@/components/customFields/customFieldExamples';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('prefillFromExample', () => {
  it('collects the translated name and options', () => {
    const diet = CUSTOM_FIELD_EXAMPLES.find((example) => example.id === 'diet');
    if (!diet) throw new Error('missing example');
    expect(prefillFromExample(diet, (key) => `T:${key}`)).toEqual({
      name: 'T:examples.items.diet.name',
      type: 'SELECT',
      options: [
        'T:examples.items.diet.option1',
        'T:examples.items.diet.option2',
        'T:examples.items.diet.option3',
      ],
    });
  });

  it('has a name for every example in the English locale', () => {
    const items = enMessages.customFields.settings.examples.items as Record<string, { name: string }>;
    for (const example of CUSTOM_FIELD_EXAMPLES) {
      expect(items[example.id]?.name).toBeTruthy();
    }
  });
});

describe('CustomFieldsManager examples', () => {
  it('fills the new field form from an example chip', async () => {
    const user = userEvent.setup();
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <CustomFieldsManager initialTemplates={[]} usage={null} />
      </NextIntlClientProvider>
    );
    await user.click(screen.getByRole('button', { name: 'Diet' }));
    expect(screen.getByLabelText('Name')).toHaveValue('Diet');
    expect(screen.getByRole('radio', { name: 'Single-select' })).toBeChecked();
    expect(screen.getByDisplayValue('Vegan')).toBeInTheDocument();
  });
});
