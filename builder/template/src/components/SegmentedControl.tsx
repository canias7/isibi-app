import { cx } from '../lib/cx.js'
import type { Option } from '../lib/types.ts'

interface SegmentedControlProps {
  options?: any[]
  value?: any
  onChange?: (...args: any[]) => any
  size?: string
  className?: string
}

// SegmentedControl — compact view/mode switcher (List | Board | Calendar).
export default function SegmentedControl({ options = [], value, onChange, size = 'md', className }: SegmentedControlProps) {
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
  return (
    <div className={cx('inline-flex rounded-xl bg-ink-100 p-1', className)} role="tablist">
      {opts.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value}
          onClick={() => onChange && onChange(o.value)}
          className={cx('inline-flex items-center gap-1.5 rounded-lg font-medium transition', pad,
            value === o.value ? 'bg-surface text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800')}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  )
}
