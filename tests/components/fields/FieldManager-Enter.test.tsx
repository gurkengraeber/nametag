import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../../locales/en.json';
import FieldManager from '@/components/fields/FieldManager';
import { phoneFieldConfig } from '@/lib/field-configs';

describe('FieldManager - Enter key', () => {
  it('adds the entry and does not submit the surrounding form', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <form onSubmit={onSubmit}>
          <FieldManager
            items={[]}
            onChange={onChange}
            fieldConfig={phoneFieldConfig}
            label="Phone Numbers"
            emptyText="None"
          />
          <button type="submit">Save</button>
        </form>
      </NextIntlClientProvider>
    );

    await user.click(screen.getByText('+ Add'));
    await user.type(screen.getByPlaceholderText(/phone/i), '555 0100{Enter}');

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ number: '555 0100' })]);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
