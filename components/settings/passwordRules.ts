export type PasswordRuleError =
  | 'passwordTooShort'
  | 'passwordNeedsUppercase'
  | 'passwordNeedsLowercase'
  | 'passwordNeedsNumber'
  | 'passwordNeedsSpecial';

/**
 * The first password rule a candidate breaks, as a settings.security message
 * key, or null when it passes. Mirrors the server's schema so the person hears
 * about a weak password before the request is sent.
 */
export function firstPasswordRuleError(password: string): PasswordRuleError | null {
  if (password.length < 8) return 'passwordTooShort';
  if (!/[A-Z]/.test(password)) return 'passwordNeedsUppercase';
  if (!/[a-z]/.test(password)) return 'passwordNeedsLowercase';
  if (!/[0-9]/.test(password)) return 'passwordNeedsNumber';
  if (!/[^A-Za-z0-9]/.test(password)) return 'passwordNeedsSpecial';
  return null;
}
