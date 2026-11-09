import { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

interface EmptyStateProps {
  icon?: string | ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  /** A quieter second way forward, for example importing instead of creating. */
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  /** `compact` fits small surfaces such as dropdowns and cards. */
  size?: 'default' | 'compact';
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  secondaryActionLabel,
  secondaryActionHref,
  size = 'default',
}: EmptyStateProps) {
  const compact = size === 'compact';
  const hasPrimary = Boolean(actionLabel && actionHref);
  const hasSecondary = Boolean(secondaryActionLabel && secondaryActionHref);

  return (
    <div className={compact ? 'text-center px-4 py-5' : 'text-center py-12 px-4'}>
      {icon && (
        <div className="flex justify-center mb-4">
          {typeof icon === 'string' ? (
            <div className="text-6xl">{icon}</div>
          ) : (
            icon
          )}
        </div>
      )}
      <h3 className={`font-medium text-foreground mb-2 ${compact ? 'text-base' : 'text-lg'}`}>
        {title}
      </h3>
      <p className={`text-sm text-muted max-w-md mx-auto ${hasPrimary || hasSecondary ? 'mb-6' : ''}`}>
        {description}
      </p>
      {(hasPrimary || hasSecondary) && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 max-w-xs sm:max-w-none mx-auto">
          {hasPrimary && actionLabel && actionHref && (
            <Button href={actionHref}>{actionLabel}</Button>
          )}
          {hasSecondary && secondaryActionLabel && secondaryActionHref && (
            <Button href={secondaryActionHref} variant="secondary">{secondaryActionLabel}</Button>
          )}
        </div>
      )}
    </div>
  );
}
