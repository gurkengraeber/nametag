'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from './ui/Button';

interface DefaultRelationshipTypesButtonProps {
  /** Display labels in the user's language, keyed by standard type name. */
  labels: Record<string, string>;
}

export default function DefaultRelationshipTypesButton({ labels }: DefaultRelationshipTypesButtonProps) {
  const t = useTranslations('relationshipTypes.defaults');
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/relationship-types/defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || t('error'));
        return;
      }

      toast.success(t('success', { count: data.created }));
      router.refresh();
    } catch {
      toast.error(t('errorConnection'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button variant="secondary" onClick={handleClick} disabled={isLoading}>
      {isLoading ? t('creating') : t('button')}
    </Button>
  );
}
