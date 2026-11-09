'use client';

import { PRESET_COLORS, getRandomColor } from '@/lib/colors';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label: string;
  customLabel: string;
  randomLabel: string;
}

/**
 * A short row of suggested colors plus a free color field and a random
 * button. Shared by the group and relationship type forms.
 */
export default function ColorPicker({
  value,
  onChange,
  label,
  customLabel,
  randomLabel,
}: ColorPickerProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-muted mb-2">{label}</label>
      <div className="flex flex-wrap gap-2 sm:gap-3">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            aria-pressed={value.toLowerCase() === color.toLowerCase()}
            className={`w-11 h-11 sm:w-10 sm:h-10 rounded-full transition-shadow ${
              value.toLowerCase() === color.toLowerCase()
                ? 'ring-4 ring-primary ring-offset-2 dark:ring-offset-gray-800'
                : 'hover:ring-2 hover:ring-border'
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
      <div className="mt-3">
        <label htmlFor="customColor" className="block text-xs text-muted mb-1">
          {customLabel}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            id="customColor"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-20 h-11 sm:h-10 rounded cursor-pointer"
          />
          <button
            type="button"
            onClick={() => onChange(getRandomColor())}
            className="inline-flex h-11 w-11 sm:h-8 sm:w-8 items-center justify-center rounded-md text-muted hover:bg-surface-elevated hover:text-foreground"
            aria-label={randomLabel}
            title={randomLabel}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <rect width="12" height="12" x="2" y="10" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
              <path strokeLinecap="round" strokeLinejoin="round" d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18h.01" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14h.01" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 6h.01" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9h.01" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
