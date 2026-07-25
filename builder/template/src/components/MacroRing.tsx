import { cx } from '../lib/cx.js'

interface MacroRingProps {
  parts?: any[]
  total?: any
  totalLabel?: string
  goal?: any
  size?: number
  thickness?: number
  className?: string
}

// MacroRing — a stacked ring showing how a total splits, with the total in the middle. Nutrition macros is
// the obvious case, but it fits any "budget of X, spent on A/B/C" breakdown.
// parts: [{label, value, unit, className}]  — DonutChart is the generic version; this one centres a big total
// and lists the parts underneath, which is the layout a tracking app actually wants.
export default function MacroRing({
  parts = [], total, totalLabel = 'kcal', goal, size = 160, thickness = 14, className,
}: MacroRingProps) {
  const sum = parts.reduce((s, p) => s + (p.value || 0), 0) || 1
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const tones = ['text-brand-500', 'text-accent-500', 'text-emerald-500', 'text-sky-500', 'text-rose-400']
  let offset = 0
  return (
    <div className={cx('flex flex-wrap items-center gap-6', className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label="Breakdown">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness} className="stroke-ink-100" />
          {parts.map((p, i) => {
            const len = ((p.value || 0) / sum) * c
            const el = (
              <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness} strokeLinecap="butt"
                stroke="currentColor" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}
                className={p.className || tones[i % tones.length]} />
            )
            offset += len
            return el
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-bold tabular-nums leading-none text-ink-900">{total ?? sum}</span>
          <span className="mt-0.5 text-xs text-ink-400">{totalLabel}</span>
          {goal && <span className="mt-1 text-[11px] tabular-nums text-ink-400">of {goal}</span>}
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2.5">
        {parts.map((p, i) => (
          <li key={i}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="inline-flex items-center gap-2 text-ink-600">
                <span className={cx('h-2.5 w-2.5 rounded-full bg-current', p.className || tones[i % tones.length])} />
                {p.label}
              </span>
              <span className="font-medium tabular-nums text-ink-900">{p.value}{p.unit || 'g'}</span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-ink-100">
              <div className={cx('h-full rounded-full bg-current', p.className || tones[i % tones.length])}
                style={{ width: `${((p.value || 0) / sum) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
