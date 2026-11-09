'use client';

import { useTranslations } from 'next-intl';
import { formatPersonLabel, type MergeSummary, type PersonForCompare } from '@/lib/merge-compare';

interface MergeSummaryListProps {
  primary: PersonForCompare;
  secondary: PersonForCompare;
  summary: MergeSummary;
}

/** Plain-language list of what a merge will do, shown before confirming. */
export default function MergeSummaryList({ primary, secondary, summary }: MergeSummaryListProps) {
  const t = useTranslations('people.merge');
  const primaryLabel = formatPersonLabel(primary);
  const secondaryLabel = formatPersonLabel(secondary);
  const addedRows = summary.multiValue.filter((f) => f.added > 0);

  return (
    <div className="space-y-3">
      <ul className="space-y-2 text-sm text-foreground list-disc pl-5">
        <li>{t('summaryKeep', { name: primaryLabel })}</li>
        {summary.secondaryValuesChosen > 0 && (
          <li>
            {t('summaryChosen', { count: summary.secondaryValuesChosen, name: secondaryLabel })}
          </li>
        )}
        {summary.adoptedFields > 0 && (
          <li>{t('summaryAdopted', { count: summary.adoptedFields, name: secondaryLabel })}</li>
        )}
        {addedRows.map((field) => (
          <li key={field.fieldKey}>
            {t('summaryAdded', { count: field.added, field: t(field.labelKey) })}
          </li>
        ))}
        {summary.groups.added > 0 && (
          <li>{t('summaryGroups', { count: summary.groups.added })}</li>
        )}
        {summary.secondaryRelationships > 0 && (
          <li>
            {t('summaryRelationships', {
              count: summary.secondaryRelationships,
              name: secondaryLabel,
              primary: primaryLabel,
            })}
          </li>
        )}
        <li>{t('summaryJournal', { name: secondaryLabel, primary: primaryLabel })}</li>
      </ul>
      <p className="text-sm text-muted">{t('summaryRemove', { name: secondaryLabel })}</p>
    </div>
  );
}
