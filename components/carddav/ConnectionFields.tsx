'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { CARDDAV_PROVIDERS, isServerUrlEditable } from '@/lib/carddav/types';
import PasswordInput from './PasswordInput';
import ConnectionTestResult from './ConnectionTestResult';
import type { ConnectionTestState } from './useConnectionTest';

export interface ConnectionFieldValues {
  provider: string;
  serverUrl: string;
  username: string;
  password: string;
}

interface ConnectionFieldsProps {
  values: ConnectionFieldValues;
  onProviderChange: (provider: string) => void;
  onFieldChange: (field: 'serverUrl' | 'username' | 'password', value: string) => void;
  /** Editing a saved connection: the password may stay empty. */
  passwordOptional?: boolean;
  testState: ConnectionTestState;
  onTest: () => void;
  canTest: boolean;
}

const inputClass =
  'w-full px-4 py-2 border border-border rounded-lg bg-surface text-foreground text-base sm:text-sm focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed';

/**
 * Provider, server address, login and test button, shared by the setup wizard
 * and the edit dialog so both explain the same things the same way.
 */
export default function ConnectionFields({
  values,
  onProviderChange,
  onFieldChange,
  passwordOptional = false,
  testState,
  onTest,
  canTest,
}: ConnectionFieldsProps) {
  const t = useTranslations('settings.carddav');
  const providerConfig = CARDDAV_PROVIDERS[values.provider];
  const urlEditable = isServerUrlEditable(values.provider);
  const hasHelp = Boolean(providerConfig);
  const isTesting = testState.status === 'testing';

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="carddav-provider" className="block text-sm font-medium text-foreground mb-2">
          {t('providerLabel')}
        </label>
        <select
          id="carddav-provider"
          value={values.provider}
          onChange={(e) => onProviderChange(e.target.value)}
          className={inputClass}
        >
          {Object.entries(CARDDAV_PROVIDERS).map(([key, config]) => (
            <option key={key} value={key}>
              {config.name}
            </option>
          ))}
          <option value="custom">{t('customProvider')}</option>
        </select>
        <p className="mt-2 text-sm text-muted">
          {hasHelp ? t(`providerHelp.${values.provider}`) : t('providerHelp.custom')}
        </p>
      </div>

      <div>
        <label htmlFor="carddav-server-url" className="block text-sm font-medium text-foreground mb-2">
          {t('serverUrlLabel')}
        </label>
        <input
          id="carddav-server-url"
          type="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={values.serverUrl}
          onChange={(e) => onFieldChange('serverUrl', e.target.value)}
          placeholder={providerConfig?.urlPlaceholder ?? 'https://carddav.example.com'}
          required
          disabled={!urlEditable}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="carddav-username" className="block text-sm font-medium text-foreground mb-2">
          {t('usernameLabel')}
        </label>
        <input
          id="carddav-username"
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          value={values.username}
          onChange={(e) => onFieldChange('username', e.target.value)}
          placeholder={t('usernamePlaceholder')}
          required
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="carddav-password" className="block text-sm font-medium text-foreground mb-2">
          {t('passwordLabel')}
          {passwordOptional && (
            <span className="ml-2 text-xs text-muted">({t('leaveBlankToKeep')})</span>
          )}
        </label>
        <PasswordInput
          id="carddav-password"
          value={values.password}
          onChange={(value) => onFieldChange('password', value)}
          placeholder={t('passwordPlaceholder')}
          describedBy={providerConfig?.requiresAppPassword || providerConfig?.appPasswordWithTwoFactor ? 'carddav-app-password-hint' : undefined}
        />
        {(providerConfig?.requiresAppPassword || providerConfig?.appPasswordWithTwoFactor) && (
          <p id="carddav-app-password-hint" className="mt-2 text-sm text-amber-700 dark:text-amber-400">
            {providerConfig.requiresAppPassword ? t('appPasswordRequired') : t('appPasswordWithTwoFactor')}{' '}
            {providerConfig.appPasswordUrl && (
              <a
                href={providerConfig.appPasswordUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-amber-800 dark:hover:text-amber-300"
              >
                {t('appPasswordCreateLink')}
              </a>
            )}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <Button
          type="button"
          onClick={onTest}
          disabled={!canTest || isTesting}
          variant="secondary"
          fullWidth
          className="sm:w-auto"
        >
          {isTesting ? t('testing') : t('testConnection')}
        </Button>
        <ConnectionTestResult state={testState} />
      </div>
    </div>
  );
}
