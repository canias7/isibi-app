import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface SparklineProps {
  data?: any[]
  width?: number
  height?: number
  className?: string
}

// Dependency-free SVG charts. Data is a plain array of numbers, or {label, value} for bars.
// Sparkline — a compact trend line.
export function Sparkline({ data = [], width = 160, height = 40, className }: SparklineProps) {
  if (!data.length) return null
  const max = Math.max(...data), min = Math.min(...data)
  const span = max - min || 1
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1 || 1)) * width
    const y = height - ((d - min) / span) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cx('w-full', className)} preserveAspectRatio="none" role="img" aria-label="Trend">
      <polyline points={pts.join(' ')} fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" className="text-brand-500" />
    </svg>
  )
}

interface LineChartProps {
  data?: any[]
  height?: number
  className?: string
}

// LineChart — a trend with a soft area fill and axis baseline.
export function LineChart({ data = [], height = 180, className }: LineChartProps) {
  if (!data.length) return null
  const w = 100, h = 100
  const max = Math.max(...data), min = Math.min(...data, 0)
  const span = max - min || 1
  const pts = data.map((d, i) => [ (i / (data.length - 1 || 1)) * w, h - ((d - min) / span) * h ])
  const line = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = `0,${h} ${line} ${w},${h}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height }} className={cx('w-full', className)} role="img" aria-label="Chart">
      <polygon points={area} className="fill-brand-500/10" />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke"
        strokeLinecap="round" strokeLinejoin="round" className="text-brand-500" />
    </svg>
  )
}

interface BarChartProps {
  items?: any[]
  height?: number
  className?: string
}

// BarChart — categorical comparison. items: [{label, value}]
export function BarChart({ items = [], height = 180, className }: BarChartProps) {
  if (!items.length) return null
  const max = Math.max(...items.map((i) => i.value)) || 1
  return (
    <div className={cx('w-full', className)}>
      <div className="flex items-end gap-2" style={{ height }}>
        {items.map((it, i) => (
          // h-full is required: the bar's percentage height resolves against THIS column, so the column must
          // itself have a definite height (otherwise it sizes to content and every bar collapses to 0).
          <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-xs font-medium tabular-nums text-ink-500">{it.value}</span>
            <div className="w-full shrink-0 rounded-t-md bg-brand-500/85 transition-all"
              style={{ height: `${Math.max(2, (it.value / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {items.map((it, i) => (
          <span key={i} className="min-w-0 flex-1 truncate text-center text-xs text-ink-400">{it.label}</span>
        ))}
      </div>
    </div>
  )
}

interface DonutChartProps {
  segments?: any[]
  size?: number
  thickness?: number
  center?: ReactNode
  className?: string
}

// DonutChart — part-to-whole. segments: [{label, value, className?}]
export function DonutChart({ segments = [], size = 140, thickness = 16, center, className }: DonutChartProps) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  let offset = 0
  const tones = ['text-brand-500', 'text-accent-400', 'text-emerald-500', 'text-sky-500', 'text-rose-400']
  return (
    <div className={cx('inline-flex items-center gap-5', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label="Breakdown">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness} className="stroke-ink-100" />
          {segments.map((s, i) => {
            const len = (s.value / total) * c
            const el = (
              <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness}
                stroke="currentColor" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}
                className={s.className || tones[i % tones.length]} />
            )
            offset += len
            return el
          })}
        </svg>
        {center && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-xl font-semibold text-ink-900">{center}</span>
          </div>
        )}
      </div>
      {segments.length > 0 && (
        <ul className="space-y-1.5">
          {segments.map((s, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className={cx('h-2.5 w-2.5 rounded-full bg-current', s.className || tones[i % tones.length])} />
              <span className="text-ink-600">{s.label}</span>
              <span className="font-medium tabular-nums text-ink-900">{s.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Sparkline
