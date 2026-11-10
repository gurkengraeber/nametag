'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { CARDDAV_PROVIDERS } from '@/lib/carddav/types';
import { normalizeServerUrl } from '@/lib/carddav-ui/connection-test';
import type { CardDavConnectionResponse } from '@/lib/carddav/types';
import ConnectionWizard from './ConnectionWizard';
import ConnectionFields from './ConnectionFields';
import { useConnectionTest } from './useConnectionTest';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingConnection: CardDavConnectionResponse | null;
}

export default function ConnectionModal({
  isOpen,
  onClose,
  existingConnection,
}: ConnectionModalProps) {
  // Use wizard for new connections
  if (!existingConnection) {
    return <ConnectionWizard isOpen={isOpen} onClose={onClose} />;
  }

  // Edit flow uses the original single-form modal
  return (
    <ConnectionEditModal
      isOpen={isOpen}
      onClose={onClose}
      existingConnection={existingConnection}
    />
  );
}

function ConnectionEditModal({
  isOpen,
  onClose,
  existingConnection,
}: {
  isOpen: boolean;
  onClose: () => void;
  existingConnection: CardDavConnectionResponse;
}) {
  const t = useTranslations('settings.carddav');
  const router = useRouter();

  const [provider, setProvider] = useState(existingConnection.provider || 'custom');
  const [serverUrl, setServerUrl] = useState(existingConnection.serverUrl || '');
  const [username, setUsername] = useState(existingConnection.username || '');
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { state: testState, run: runTest, reset: resetTest } = useConnectionTest();
  const [error, setError] = useState('');
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  // Reset form when modal opens/closes or connection changes
  useEffect(() => {
    if (isOpen) {
      setProvider(existingConnection.provider || 'custom');
      setServerUrl(existingConnection.serverUrl || '');
      setUsername(existingConnection.username || '');
      setPassword('');
      resetTest();
      setError('');
    }
  }, [isOpen, existingConnection, resetTest]);

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const providerConfig = CARDDAV_PROVIDERS[newProvider];
    setServerUrl(providerConfig?.serverUrl || '');
    resetTest();
    setError('');
  };

  const handleFieldChange = (field: 'serverUrl' | 'username' | 'password', value: string) => {
    if (field === 'serverUrl') setServerUrl(value);
    if (field === 'username') setUsername(value);
    if (field === 'password') setPassword(value);
    resetTest();
  };

  const handleTestConnection = async () => {
    setError('');
    const normalizedUrl = normalizeServerUrl(serverUrl);
    setServerUrl(normalizedUrl);
    await runTest({ serverUrl: normalizedUrl, username, password });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');

    const normalizedUrl = normalizeServerUrl(serverUrl);

    try {
      const response = await fetch('/api/carddav/connection', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverUrl: normalizedUrl,
          username,
          password: password || undefined,
          provider: provider !== 'custom' ? provider : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t('saveFailed'));
      } else {
        router.refresh();
        onClose();
      }
    } catch (_err) {
      setError(t('saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setDisconnectError(null);

    try {
      const response = await fetch('/api/carddav/connection', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        setDisconnectError(data.error || t('disconnectFailed'));
      } else {
        router.refresh();
        setShowDisconnectConfirm(false);
        onClose();
      }
    } catch (_err) {
      setDisconnectError(t('disconnectError'));
    } finally {
      setIsDisconnecting(false);
    }
  };

  // The password may stay empty: the saved one is kept
  const isFormComplete = Boolean(serverUrl && username);
  const canSave = testState.status === 'success' && !isSaving;

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('connectionModalEditTitle')}
      size="lg"
    >
      <div className="space-y-6">
        <ConnectionFields
          values={{ provider, serverUrl, username, password }}
          onProviderChange={handleProviderChange}
          onFieldChange={handleFieldChange}
          passwordOptional
          testState={testState}
          onTest={handleTestConnection}
          canTest={isFormComplete}
        />

        {/* Form validation message */}
        {!isFormComplete && (
          <div className="p-4 bg-surface-elevated rounded-lg border border-border">
            <p className="text-sm text-muted">
              {t('fillAllFields')}
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3 sm:flex-row pt-4 border-t border-border">
          <Button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
          >
            {isSaving ? t('saving') : t('update')}
          </Button>

          <Button
            type="button"
            onClick={onClose}
            variant="secondary"
          >
            {t('cancel')}
          </Button>
        </div>
        {testState.status !== 'success' && isFormComplete && (
          <p className="text-sm text-muted -mt-3">{t('testBeforeSave')}</p>
        )}

        {/* Disconnect section */}
        <div className="pt-4 border-t border-border">
          <Button
            type="button"
            onClick={() => setShowDisconnectConfirm(true)}
            disabled={isSaving}
            variant="danger"
            fullWidth
          >
            {t('disconnectButton')}
          </Button>
        </div>
      </div>
    </Modal>

    <ConfirmationModal
      isOpen={showDisconnectConfirm}
      onClose={() => {
        setShowDisconnectConfirm(false);
        setDisconnectError(null);
      }}
      onConfirm={handleDisconnect}
      title={t('disconnectConfirmTitle')}
      confirmText={t('disconnect')}
      cancelText={t('cancel')}
      isLoading={isDisconnecting}
      loadingText={t('saving')}
      error={disconnectError}
      variant="danger"
    >
      <p className="text-muted">
        {t('disconnectConfirmMessage')}
      </p>
    </ConfirmationModal>
    </>
  );
}
