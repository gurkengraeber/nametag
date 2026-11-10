import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import GraphSearch from '../../components/GraphSearch';
import enMessages from '../../locales/en.json';

const person = (id: string, label: string) => ({
  id,
  label,
  groups: [],
  colors: [],
  isCenter: false,
});

const people = [person('p-1', 'Anna Berg'), person('p-2', 'Anton Lund')];

function renderSearch(onSelect = vi.fn(), onClear = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <GraphSearch people={people} onSelect={onSelect} onClear={onClear} />
    </NextIntlClientProvider>,
  );
  return { onSelect, onClear };
}

describe('GraphSearch', () => {
  it('picks the first hit with Enter', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderSearch();
    await user.type(screen.getByRole('combobox'), 'an{Enter}');
    expect(onSelect).toHaveBeenCalledWith('p-1');
  });

  it('does not pick a person while an IME composition is confirmed with Enter', () => {
    const { onSelect } = renderSearch();
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'an' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('p-1');
  });

  it('keeps the text while Escape cancels an IME composition', () => {
    const { onClear } = renderSearch();
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'an' } });
    fireEvent.keyDown(input, { key: 'Escape', isComposing: true });
    expect(input).toHaveValue('an');
    expect(onClear).not.toHaveBeenCalled();
  });
});
