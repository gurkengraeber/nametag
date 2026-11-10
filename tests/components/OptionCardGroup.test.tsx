import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import OptionCardGroup from '../../components/settings/OptionCardGroup';

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
];

function Harness({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState('b');
  return (
    <OptionCardGroup
      label="Letters"
      options={options}
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
}

describe('OptionCardGroup keyboard', () => {
  it('has the selected card as its only tab stop', () => {
    render(<Harness onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('radio', { name: 'Gamma' })).toHaveAttribute('tabindex', '-1');
  });

  it('moves the choice and the focus with the arrow keys, wrapping around', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    screen.getByRole('radio', { name: 'Beta' }).focus();

    await userEvent.keyboard('{ArrowDown}');
    expect(onChange).toHaveBeenLastCalledWith('c');
    expect(screen.getByRole('radio', { name: 'Gamma' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Gamma' })).toHaveAttribute('aria-checked', 'true');

    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('a');
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveFocus();

    await userEvent.keyboard('{ArrowUp}');
    expect(onChange).toHaveBeenLastCalledWith('c');
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('b');
  });
});
