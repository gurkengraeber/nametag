'use client';

import { useState, FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import SettingsSaveBar from '@/components/settings/SettingsSaveBar';
import { useUnsavedChangesWarning } from '@/components/settings/useUnsavedChangesWarning';
import { parseApiError } from '@/components/settings/formState';
import { firstPasswordRuleError } from '@/components/settings/passwordRules';

interface PasswordChangeFormProps {
  userId: string;
}

type PasswordField = 'currentPassword' | 'newPassword' | 'confirmPassword';

const EMPTY_FORM: Record<PasswordField, string> = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const INPUT_CLASS =
  'w-full min-h-11 px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

export default function PasswordChangeForm({}: PasswordChangeFormProps) {
  const t = useTranslations('settings.security');
  const tUnsaved = useTranslations('settings.unsaved');
  const { data: session } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<PasswordField, string>>>({});
  const [showPasswords, setShowPasswords] = useState(false);

  const [formData, setFormData] = useState(EMPTY_FORM);

  const isDirty = Object.values(formData).some((value) => value !== '');
  useUnsavedChangesWarning(isDirty, tUnsaved('warning'));

  const setField = (field: PasswordField, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (fieldErrors[field]) {
      setFieldErrors({ ...fieldErrors, [field]: undefined });
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const ruleError = firstPasswordRuleError(formData.newPassword);
    if (ruleError) {
      setFieldErrors({ newPassword: t(ruleError) });
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setFieldErrors({ confirmPassword: t('passwordsNoMatch') });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/user/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        const info = parseApiError(data);
        if (info.code === 'wrong_password') {
          setFieldErrors({ currentPassword: info.message ?? t('errorUpdate') });
        } else if (Object.keys(info.fields).length > 0) {
          const mapped: Partial<Record<PasswordField, string>> = {};
          for (const field of ['currentPassword', 'newPassword', 'confirmPassword'] as const) {
            if (info.fields[field]) mapped[field] = info.fields[field];
          }
          if (Object.keys(mapped).length > 0) {
            setFieldErrors(mapped);
          } else {
            setError(t('errorValidation'));
          }
        } else {
          setError(info.message ?? t('errorUpdate'));
        }
        return;
      }

      // The change signed out every session, including this one. Sign back in
      // with the new password so this browser gets a fresh token.
      const email = session?.user?.email;
      const reSignIn = email
        ? await signIn('credentials', { email, password: formData.newPassword, redirect: false })
        : undefined;
      if (!reSignIn || reSignIn.error) {
        router.push('/login');
        return;
      }

      toast.success(t('successUpdate'));
      setFormData(EMPTY_FORM);
      setShowPasswords(false);
    } catch {
      setError(t('errorConnection'));
    } finally {
      setIsLoading(false);
    }
  };

  const fieldProps = (field: PasswordField) => ({
    'aria-invalid': fieldErrors[field] ? true : undefined,
    'aria-describedby': fieldErrors[field] ? `${field}-error` : undefined,
  });
  const inputType = showPasswords ? 'text' : 'password';

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && (
        <div role="alert" className="bg-warning/10 border border-warning/30 text-warning px-4 py-3 rounded">
          <div className="font-medium">{error}</div>
        </div>
      )}

      <div>
        <label
          htmlFor="currentPassword"
          className="block text-sm font-medium text-muted mb-1"
        >
          {t('currentPassword')}
        </label>
        <input
          type={inputType}
          id="currentPassword"
          required
          autoComplete="current-password"
          value={formData.currentPassword}
          onChange={(e) => setField('currentPassword', e.target.value)}
          className={INPUT_CLASS}
          {...fieldProps('currentPassword')}
        />
        {fieldErrors.currentPassword && (
          <p id="currentPassword-error" className="mt-1 text-sm text-warning">{fieldErrors.currentPassword}</p>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="newPassword"
          className="block text-sm font-medium text-muted mb-1"
        >
          {t('newPassword')}
        </label>
        <input
          type={inputType}
          id="newPassword"
          required
          autoComplete="new-password"
          value={formData.newPassword}
          onChange={(e) => setField('newPassword', e.target.value)}
          className={INPUT_CLASS}
          {...fieldProps('newPassword')}
        />
        {fieldErrors.newPassword && (
          <p id="newPassword-error" className="text-sm text-warning">{fieldErrors.newPassword}</p>
        )}
        <PasswordStrengthIndicator password={formData.newPassword} showRequirements={true} />
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium text-muted mb-1"
        >
          {t('confirmPassword')}
        </label>
        <input
          type={inputType}
          id="confirmPassword"
          required
          autoComplete="new-password"
          value={formData.confirmPassword}
          onChange={(e) => setField('confirmPassword', e.target.value)}
          className={INPUT_CLASS}
          {...fieldProps('confirmPassword')}
        />
        {fieldErrors.confirmPassword && (
          <p id="confirmPassword-error" className="mt-1 text-sm text-warning">{fieldErrors.confirmPassword}</p>
        )}
      </div>

      <label className="flex items-center gap-2 min-h-11 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={showPasswords}
          onChange={(e) => setShowPasswords(e.target.checked)}
          className="w-4 h-4 text-primary bg-surface border-border rounded focus:ring-2 focus:ring-primary"
        />
        <span className="text-sm text-muted">{t('showPasswords')}</span>
      </label>

      <SettingsSaveBar
        dirty={isDirty}
        isSaving={isLoading}
        showIdleStatus={false}
        saveLabel={t('updatePassword')}
        savingLabel={t('updating')}
        onDiscard={() => {
          setFormData(EMPTY_FORM);
          setFieldErrors({});
          setError('');
        }}
      />
    </form>
  );
}
