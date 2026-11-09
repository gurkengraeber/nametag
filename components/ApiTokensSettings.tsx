'use client';

import { useCallback, useEffect, useState, FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import {
  TOKEN_EXPIRY_PRESETS,
  expiryForPreset,
  isCustomDateMissing,
  type TokenExpiryPreset,
} from '@/components/settings/apiTokenExpiry';

type ApiTokenScope = 'READ' | 'READ_WRITE';

interface ApiToken {
  id: string;
  name: string;
  prefix: string;
  scope: ApiTokenScope;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface CreatedApiToken extends ApiToken {
  token: string;
}

export default function ApiTokensSettings() {
  const t = useTranslations('settings.apiTokens');

  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [scope, setScope] = useState<ApiTokenScope>('READ_WRITE');
  const [expiryPreset, setExpiryPreset] = useState<TokenExpiryPreset>('never');
  const [expiresAt, setExpiresAt] = useState('');
  const [nameError, setNameError] = useState('');
  const [tokenToRevoke, setTokenToRevoke] = useState<ApiToken | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [creating, setCreating] = useState(false);

  // Plaintext of a just-created token, shown once.
  const [newToken, setNewToken] = useState<CreatedApiToken | null>(null);
  const [copied, setCopied] = useState(false);

  const loadTokens = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/user/api-tokens');
      if (!res.ok) throw new Error('load failed');
      const data = await res.json();
      setTokens(data.tokens ?? []);
    } catch {
      setError(t('errorLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setNewToken(null);
    setCopied(false);
    setNameError('');

    if (!name.trim()) {
      setNameError(t('errorNameRequired'));
      return;
    }
    if (isCustomDateMissing(expiryPreset, expiresAt)) {
      setError(t('errorExpiryRequired'));
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/user/api-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          scope,
          expiresAt: expiryForPreset(expiryPreset, expiresAt),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t('errorCreate'));
        return;
      }
      setNewToken(data.apiToken as CreatedApiToken);
      setName('');
      setScope('READ_WRITE');
      setExpiryPreset('never');
      setExpiresAt('');
      toast.success(t('createdToast'));
      await loadTokens();
    } catch {
      setError(t('errorConnection'));
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!tokenToRevoke) return;
    setRevoking(true);
    setError('');
    try {
      const res = await fetch(`/api/user/api-tokens/${tokenToRevoke.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        toast.error(t('errorRevoke'));
        return;
      }
      toast.success(t('revokedToast'));
      setTokenToRevoke(null);
      await loadTokens();
    } catch {
      toast.error(t('errorConnection'));
    } finally {
      setRevoking(false);
    }
  };

  const handleCopy = async () => {
    if (!newToken) return;
    try {
      await navigator.clipboard.writeText(newToken.token);
      setCopied(true);
      toast.success(t('copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable (non-secure context); the token is
      // selectable, so tell the person to copy it by hand.
      toast.error(t('copyFailed'));
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return '-';
    return new Date(value).toLocaleString();
  };

  return (
    <div className="space-y-8">
      {error && (
        <div
          role="alert"
          className="bg-warning/10 border border-warning/30 text-warning px-4 py-3 rounded"
        >
          {error}
        </div>
      )}

      {/* One-time plaintext token banner */}
      {newToken && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-400 dark:border-green-800 rounded-lg p-4 space-y-3">
          <p className="text-green-800 dark:text-green-300 font-medium">
            {t('createdTitle')}
          </p>
          <p className="text-sm text-green-700 dark:text-green-400">
            {t('copyOnce')}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <code
              className="flex-1 px-3 py-2 rounded bg-surface border border-border text-foreground text-sm break-all select-all"
              data-testid="new-token"
            >
              {newToken.token}
            </code>
            <Button type="button" onClick={handleCopy}>
              {copied ? t('copied') : t('copy')}
            </Button>
          </div>
          <p className="text-sm text-green-700 dark:text-green-400">
            {t('usageHint')} <code className="break-all">Authorization: Bearer &lt;token&gt;</code>
          </p>
          <button
            type="button"
            onClick={() => setNewToken(null)}
            className="min-h-11 sm:min-h-0 text-sm text-muted hover:text-foreground underline"
          >
            {t('dismiss')}
          </button>
        </div>
      )}

      {/* Create form */}
      <form onSubmit={handleCreate} className="space-y-4" noValidate>
        <h3 className="text-lg font-semibold text-foreground">{t('createTitle')}</h3>

        <div>
          <label htmlFor="token-name" className="block text-sm font-medium text-muted mb-1">
            {t('nameLabel')}
          </label>
          <input
            id="token-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError('');
            }}
            placeholder={t('namePlaceholder')}
            maxLength={100}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? 'token-name-error' : 'token-name-hint'}
            className="w-full min-h-11 px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {nameError ? (
            <p id="token-name-error" className="mt-1 text-sm text-warning">{nameError}</p>
          ) : (
            <p id="token-name-hint" className="mt-1 text-sm text-muted">{t('nameHint')}</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="token-scope" className="block text-sm font-medium text-muted mb-1">
              {t('scopeLabel')}
            </label>
            <select
              id="token-scope"
              value={scope}
              onChange={(e) => setScope(e.target.value as ApiTokenScope)}
              aria-describedby="token-scope-hint"
              className="w-full min-h-11 px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="READ_WRITE">{t('scopeReadWrite')}</option>
              <option value="READ">{t('scopeRead')}</option>
            </select>
            <p id="token-scope-hint" className="mt-1 text-sm text-muted">
              {scope === 'READ' ? t('scopeReadHint') : t('scopeReadWriteHint')}
            </p>
          </div>

          <div className="flex-1">
            <label htmlFor="token-expiry-preset" className="block text-sm font-medium text-muted mb-1">
              {t('expiryLabel')}
            </label>
            <select
              id="token-expiry-preset"
              value={expiryPreset}
              onChange={(e) => setExpiryPreset(e.target.value as TokenExpiryPreset)}
              className="w-full min-h-11 px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {TOKEN_EXPIRY_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {t(`expiry.${preset}`)}
                </option>
              ))}
            </select>
            {expiryPreset === 'custom' && (
              <input
                id="token-expiry"
                type="date"
                aria-label={t('expiry.custom')}
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="mt-2 w-full min-h-11 px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={creating}>
            {creating ? t('creating') : t('createButton')}
          </Button>
        </div>
      </form>

      {/* Existing tokens */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">{t('existingTitle')}</h3>

        {loading ? (
          <p className="text-muted">{t('loading')}</p>
        ) : tokens.length === 0 ? (
          <p className="text-muted">{t('empty')}</p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {tokens.map((token) => (
              <li
                key={token.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 bg-surface"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground break-words">
                    {token.name}
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                      {token.scope === 'READ' ? t('scopeRead') : t('scopeReadWrite')}
                    </span>
                  </p>
                  <p className="text-sm text-muted">
                    <code>{token.prefix}…</code>
                  </p>
                  <p className="text-sm text-muted">
                    {t('createdAt')}: {formatDate(token.createdAt)} · {t('lastUsed')}:{' '}
                    {token.lastUsedAt ? formatDate(token.lastUsedAt) : t('neverUsed')}
                  </p>
                  <p className="text-sm text-muted">
                    {t('expires')}: {token.expiresAt ? formatDate(token.expiresAt) : t('never')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="custom"
                  className="flex-shrink-0 border border-warning/40 text-warning hover:bg-warning/10"
                  onClick={() => setTokenToRevoke(token)}
                  aria-label={`${t('revoke')}: ${token.name}`}
                >
                  {t('revoke')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmationModal
        isOpen={tokenToRevoke !== null}
        onClose={() => setTokenToRevoke(null)}
        onConfirm={handleRevoke}
        title={t('revokeTitle', { name: tokenToRevoke?.name ?? '' })}
        confirmText={t('revoke')}
        cancelText={t('cancel')}
        isLoading={revoking}
        loadingText={t('revoking')}
        variant="danger"
      >
        <p>{t('confirmRevoke')}</p>
      </ConfirmationModal>
    </div>
  );
}
