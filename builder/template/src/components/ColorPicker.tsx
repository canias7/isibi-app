import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

// ColorPicker — a swatch row plus the native picker for anything else. For brand settings, product colourways,
// tag colours, calendar categories. value/onChange are hex strings.
export const SWATCHES = ['#0f172a', '#475569', '#dc2626', '#ea580c', '#f59e0b', '#16a34a', '#0d9488', '#0284c7', '#4f46e5', '#9333ea', '#db2777', '#f5f5f4']

interface ColorPickerProps {
  value?: any
  onChange?: (...args: any[]) => any
  swatches?: string[]
  label?: ReactNode
  allowCustom?: boolean
  className?: string
}

export default function ColorPicker({ value, onChange, swatches = SWATCHES, label, allowCustom = true, className }: ColorPickerProps) {
  return (
    <div className={className}>
      {label && <p className="mb-2 text-sm font-medium text-ink-700">{label}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {swatches.map((c) => (
          <button key={c} type="button" onClick={() => onChange && onChange(c)} aria-label={String(c ?? "")} aria-pressed={value === c}
            style={{ backgroundColor: c }}
            className={cx('h-8 w-8 rounded-full transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
              // A ring OUTSIDE the swatch, so selection reads on a pale colour as well as a dark one.
              value === c ? 'ring-2 ring-ink-900 ring-offset-2 ring-offset-surface' : 'hover:scale-110')} />
        ))}
        {allowCustom && (
          <label className="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-ink-300 text-[10px] font-medium text-ink-400 transition hover:border-ink-400 hover:text-ink-600 focus-within:ring-2 focus-within:ring-brand-500">
            <span aria-hidden="true">+</span>
            <input type="color" value={value || '#000000'} onChange={(e) => onChange && onChange((e.target as any).value)}
              aria-label="Custom colour" className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
        )}
        {value && <span className="ml-1 font-mono text-xs uppercase tabular-nums text-ink-500">{value}</span>}
      </div>
    </div>
  )
}
