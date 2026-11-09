import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import LastContactSection from '../../components/person-form/LastContactSection';
import enMessages from '../../locales/en.json';
import type { FormData } from '../../hooks/usePersonForm';

function renderSection(enabled: boolean, onFormDataChange = vi.fn()) {
  const formData = {
    lastContact: '',
    contactReminderEnabled: enabled,
    contactReminderInterval: 3,
    contactReminderIntervalUnit: 'MONTHS',
  } as FormData;
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <LastContactSection formData={formData} onFormDataChange={onFormDataChange} />
    </NextIntlClientProvider>
  );
  return onFormDataChange;
}

describe('LastContactSection reminder toggle', () => {
  it('is announced as a switch that reports its state', () => {
    renderSection(true);
    expect(screen.getByRole('switch', { name: enMessages.people.form.remindMeToCatchUp })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  it('reports "off" and turns on when pressed', () => {
    const onChange = renderSection(false);
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(toggle);

    expect(onChange).toHaveBeenCalledWith({ contactReminderEnabled: true });
  });
});
