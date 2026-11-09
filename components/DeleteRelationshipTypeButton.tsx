'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import ConfirmationModal from './ui/ConfirmationModal';
import { getDeleteImpact } from '@/lib/relationship-type-stats';

interface DeleteRelationshipTypeButtonProps {
  relationshipTypeId: string;
  relationshipTypeName: string;
  /** People you have this relationship with. */
  peopleCount: number;
  /** Connections between two people that use this type. */
  connectionCount: number;
}

export default function DeleteRelationshipTypeButton({
  relationshipTypeId,
  relationshipTypeName,
  peopleCount,
  connectionCount,
}: DeleteRelationshipTypeButtonProps) {
  const t = useTranslations('relationshipTypes.delete');
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const impact = getDeleteImpact(peopleCount, connectionCount);

  const handleClose = () => {
    setShowConfirm(false);
    setError(null);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/relationship-types/${relationshipTypeId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t('errorDelete'));
        return;
      }

      setShowConfirm(false);
      router.refresh();
    } catch {
      setError(t('errorDelete'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="inline-flex items-center justify-center w-11 h-11 sm:w-auto sm:h-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
        title={t('button')}
        aria-label={`${t('button')} ${relationshipTypeName}`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>

      <ConfirmationModal
        isOpen={showConfirm}
        onClose={handleClose}
        onConfirm={handleDelete}
        title={t('title')}
        confirmText={t('confirmButton')}
        cancelText={t('cancel')}
        isLoading={isDeleting}
        loadingText={t('deleting')}
        error={error}
        variant="danger"
        confirmDisabled={impact === 'blocked'}
      >
        <p className="text-muted mb-3">
          {t('confirmMessage')} <strong className="text-foreground">{relationshipTypeName}</strong>?
        </p>
        {impact === 'blocked' && (
          <p className="text-sm text-warning">
            {t('blockedByConnections', { count: connectionCount })}
          </p>
        )}
        {impact === 'people' && (
          <p className="text-sm text-muted">{t('affectsPeople', { count: peopleCount })}</p>
        )}
        {impact === 'unused' && <p className="text-sm text-muted">{t('unused')}</p>}
        {impact !== 'blocked' && (
          <p className="text-sm text-muted mt-2">{t('restoreHint')}</p>
        )}
      </ConfirmationModal>
    </>
  );
}
