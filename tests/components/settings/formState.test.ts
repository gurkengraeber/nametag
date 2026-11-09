import { describe, it, expect } from 'vitest';
import { hasChanges, isLeavingPage, parseApiError } from '@/components/settings/formState';
import { firstPasswordRuleError } from '@/components/settings/passwordRules';

describe('hasChanges', () => {
  it('is false for equal values and true for any difference', () => {
    const saved = { name: 'Ada', email: 'a@example.com' };
    expect(hasChanges({ ...saved }, saved)).toBe(false);
    expect(hasChanges({ ...saved, name: 'Ada ' }, saved)).toBe(true);
  });
});

describe('parseApiError', () => {
  it('reads message, code and field details', () => {
    const info = parseApiError({
      error: 'Validation failed',
      code: 'validation_failed',
      details: [
        { field: 'newPassword', message: 'Too short' },
        { field: 'newPassword', message: 'Ignored second message' },
        { field: 'email', message: 'Invalid' },
        'garbage',
      ],
    });
    expect(info.message).toBe('Validation failed');
    expect(info.code).toBe('validation_failed');
    expect(info.fields).toEqual({ newPassword: 'Too short', email: 'Invalid' });
  });

  it('survives unexpected bodies', () => {
    expect(parseApiError(null)).toEqual({ message: null, code: null, fields: {} });
    expect(parseApiError('x')).toEqual({ message: null, code: null, fields: {} });
    expect(parseApiError({ error: 5, details: 'no' })).toEqual({ message: null, code: null, fields: {} });
  });
});

describe('isLeavingPage', () => {
  const here = { href: 'https://example.test/settings/profile?tab=1' };

  it('ignores hash-only links and the same page', () => {
    expect(isLeavingPage('#photo', here)).toBe(false);
    expect(isLeavingPage('/settings/profile?tab=1#x', here)).toBe(false);
  });

  it('detects other paths, queries and origins', () => {
    expect(isLeavingPage('/settings/security', here)).toBe(true);
    expect(isLeavingPage('/settings/profile?tab=2', here)).toBe(true);
    expect(isLeavingPage('https://other.test/settings/profile?tab=1', here)).toBe(true);
  });

  it('ignores non-web links', () => {
    expect(isLeavingPage('mailto:a@example.com', here)).toBe(false);
  });
});

describe('firstPasswordRuleError', () => {
  it('reports the first broken rule in order', () => {
    expect(firstPasswordRuleError('Ab1!')).toBe('passwordTooShort');
    expect(firstPasswordRuleError('abcdefg1!')).toBe('passwordNeedsUppercase');
    expect(firstPasswordRuleError('ABCDEFG1!')).toBe('passwordNeedsLowercase');
    expect(firstPasswordRuleError('Abcdefgh!')).toBe('passwordNeedsNumber');
    expect(firstPasswordRuleError('Abcdefg12')).toBe('passwordNeedsSpecial');
    expect(firstPasswordRuleError('Abcdef1!')).toBeNull();
  });
});
