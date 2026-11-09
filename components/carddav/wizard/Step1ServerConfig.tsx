'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { CARDDAV_PROVIDERS } from '@/lib/carddav/types';
import { normalizeServerUrl, summarizeAddressBooks } from '@/lib/carddav-ui/connection-test';
import ConnectionFields from '../ConnectionFields';
import { useConnectionTest } from '../useConnectionTest';

export interface WizardData {
  provider: string;
  serverUrl: string;
  username: string;
  password: string;
  testPassed: boolean;
  backupDownloaded: boolean;
  syncEnabled: boolean;
  addressBookUrl: string | null;
  addressBookName: string | null;
  addressBooks: Array<{ url: string; displayName: string | null; description: string | null; contactCount: number | null }>;
}

interface Step1ServerConfigProps {
  data: WizardData;
  onUpdate: (partial: Partial<WizardData>) => void;
  onNext: () => void;
  onCancel: () => void;
}

export default function Step1ServerConfig({
  data,
  onUpdate,
  onNext,
  onCancel,
}: Step1ServerConfigProps) {
  const t = useTranslations('settings.carddav');
  const tw = useTranslations('settings.carddav.wizard');

  // Coming back from a later step keeps the earlier test result on screen
  const { state, run, reset } = useConnectionTest(
    data.testPassed
      ? { status: 'success', books: data.addressBooks, summary: summarizeAddressBooks(data.addressBooks) }
      : { status: 'idle' }
  );

  const invalidate = {
    testPassed: false,
    backupDownloaded: false,
    addressBookUrl: null,
    addressBookName: null,
    addressBooks: [],
  };

  const handleProviderChange = (newProvider: string) => {
    const providerConfig = CARDDAV_PROVIDERS[newProvider];
    onUpdate({
      provider: newProvider,
      serverUrl: providerConfig?.serverUrl || '',
      ...invalidate,
    });
    reset();
  };

  const handleFieldChange = (field: 'serverUrl' | 'username' | 'password', value: string) => {
    onUpdate({ [field]: value, ...invalidate });
    reset();
  };

  const isFormComplete = Boolean(data.serverUrl && data.username && data.password);

  const handleTestConnection = async () => {
    const books = await run({ serverUrl: data.serverUrl, username: data.username, password: data.password });
    if (books) {
      onUpdate({ serverUrl: normalizeServerUrl(data.serverUrl), testPassed: true, addressBooks: books });
    }
  };

  return (
    <div className="space-y-6">
      <ConnectionFields
        values={data}
        onProviderChange={handleProviderChange}
        onFieldChange={handleFieldChange}
        testState={state}
        onTest={handleTestConnection}
        canTest={isFormComplete}
      />

      {!isFormComplete && (
        <div className="p-4 bg-surface-elevated rounded-lg border border-border">
          <p className="text-sm text-muted">
            {t('fillAllFields')}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between pt-4 border-t border-border">
        <Button type="button" onClick={onCancel} variant="secondary">
          {t('cancel')}
        </Button>
        <Button
          type="button"
          onClick={onNext}
          disabled={!data.testPassed}
        >
          {tw('next')}
        </Button>
      </div>
    </div>
  );
}
