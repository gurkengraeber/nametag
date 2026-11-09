import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FormSection from '../../components/person-form/FormSection';

describe('FormSection', () => {
  it('is folded by default but keeps its content mounted', () => {
    render(
      <FormSection title="Notes">
        <input aria-label="inner" defaultValue="kept" />
      </FormSection>
    );
    expect(screen.getByRole('button', { name: 'Notes' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByLabelText('inner', { selector: 'input' })).not.toBeVisible();
    expect(screen.getByLabelText('inner')).toHaveValue('kept');
  });

  it('toggles open and closed', async () => {
    const user = userEvent.setup();
    render(
      <FormSection title="Notes">
        <input aria-label="inner" />
      </FormSection>
    );
    await user.click(screen.getByRole('button', { name: 'Notes' }));
    expect(screen.getByLabelText('inner')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Notes' }));
    expect(screen.getByLabelText('inner')).not.toBeVisible();
  });

  it('shows a count while folded', () => {
    render(
      <FormSection title="Contact" count={3}>
        <p>x</p>
      </FormSection>
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('opens and shows the message when there is an error', () => {
    render(
      <FormSection title="Contact" error="Check this">
        <input aria-label="inner" />
      </FormSection>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Check this');
    expect(screen.getByLabelText('inner')).toBeVisible();
  });
});
