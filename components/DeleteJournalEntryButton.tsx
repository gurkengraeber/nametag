'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import ConfirmationModal from './ui/ConfirmationModal';
import { Button } from './ui/Button';

interface DeleteJournalEntryButtonProps {
  entryId: string;
}

export default function DeleteJournalEntryButton({ entryId }: DeleteJournalEntryButtonProps) {
  const t = useTranslations('journal.detail');
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUndo = async () => {
    try {
      const response = await fetch(`/api/journal/${entryId}/restore`, { method: 'POST' });
      if (!response.ok) throw new Error('restore failed');
      toast.success(t('restored'));
      router.refresh();
    } catch {
      toast.error(t('restoreFailed'));
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/journal/${entryId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Soft delete: the entry can be brought back for as long as the toast is shown.
        toast.success(t('deleted'), {
          duration: 10000,
          action: { label: t('undo'), onClick: () => void handleUndo() },
        });
        router.push('/journal');
        router.refresh();
      } else {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error || t('deleteFailed'));
        setIsDeleting(false);
      }
    } catch {
      setError(t('deleteFailed'));
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setShowConfirm(true)}>
        {t('deleteButton')}
      </Button>

      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => { setShowConfirm(false); setError(null); }}
        onConfirm={handleDelete}
        title={t('confirmDelete')}
        confirmText={t('deleteButton')}
        isLoading={isDeleting}
        error={error}
        variant="danger"
      >
        <p className="text-muted">
          {t('confirmDeleteDescription')}
        </p>
      </ConfirmationModal>
    </>
  );
}
