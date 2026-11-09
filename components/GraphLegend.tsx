'use client';

import { useTranslations } from 'next-intl';
import type { GraphLegendData } from './graph/legend';

interface GraphLegendProps {
  data: GraphLegendData;
  /** Upper-case the first letter of relationship names (German nouns). */
  capitalizeLabels: boolean;
}

export default function GraphLegend({ data, capitalizeLabels }: GraphLegendProps) {
  const t = useTranslations('dashboard.graph.legend');
  const hasGroups = data.groups.length > 0 || data.ungroupedCount > 0;
  const hasRelationships = data.relationships.length > 0;

  const relationshipName = (label: string) =>
    capitalizeLabels ? label.charAt(0).toUpperCase() + label.slice(1) : label;

  if (!hasGroups && !hasRelationships) {
    return <p className="text-sm text-muted">{t('empty')}</p>;
  }

  return (
    <div className="space-y-3 text-sm">
      {hasGroups && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
            {t('groups')}
          </h3>
          <ul className="space-y-1">
            {data.groups.map((group) => (
              <li key={group.id} className="flex items-center gap-2 text-foreground">
                <span
                  className="inline-block w-3 h-3 rounded-full shrink-0 border border-border"
                  style={{ backgroundColor: group.color }}
                  aria-hidden="true"
                />
                <span className="truncate">{group.name}</span>
                <span className="ml-auto text-xs text-muted">{group.count}</span>
              </li>
            ))}
            {data.ungroupedCount > 0 && (
              <li className="flex items-center gap-2 text-foreground">
                <span
                  className="inline-block w-3 h-3 rounded-full shrink-0 border border-border"
                  style={{ backgroundColor: '#9CA3AF' }}
                  aria-hidden="true"
                />
                <span className="truncate">{t('noGroup')}</span>
                <span className="ml-auto text-xs text-muted">{data.ungroupedCount}</span>
              </li>
            )}
          </ul>
        </section>
      )}
      {hasRelationships && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
            {t('relationships')}
          </h3>
          <ul className="space-y-1">
            {data.relationships.map((relationship) => (
              <li key={relationship.label} className="flex items-center gap-2 text-foreground">
                <span
                  className="inline-block w-4 h-0.5 rounded-full shrink-0"
                  style={{ backgroundColor: relationship.color }}
                  aria-hidden="true"
                />
                <span className="truncate">{relationshipName(relationship.label)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
