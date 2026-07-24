import { cx } from '../lib/cx.js'

interface RadarChartProps {
  axes?: any[]
  series?: any[]
  max?: number
  size?: number
  levels?: number
  className?: string
}

// RadarChart — compare several entities across the same axes: skill profiles, product scoring, team
// assessments, feature coverage. The one chart that reads a whole multi-dimensional profile at a glance.
// axes: [{key, label}]  series: [{label, values:{key:n}, className}]
export default function RadarChart({ axes = [], series = [], max = 100, size = 240, levels = 4, className }: RadarChartProps) {
  if (axes.length < 3) return null
  const c = size / 2
  const r = c - 28
  const tones = ['text-brand-500', 'text-accent-500', 'text-emerald-500', 'text-sky-500']
  // Start at 12 o'clock (−90°) so the first axis reads as "top", which is what people expect.
  const point = (i, ratio) => {
    const a = (Math.PI * 2 * i) / axes.length - Math.PI / 2
    return [c + Math.cos(a) * r * ratio, c + Math.sin(a) * r * ratio]
  }
  const poly = (vals) => axes.map((ax, i) => point(i, Math.max(0, Math.min(1, (vals[ax.key] || 0) / max)))).map((p) => p.join(',')).join(' ')
  return (
    <div className={cx('flex flex-wrap items-center gap-6', className)}>
      <svg width={size} height={size} className="shrink-0" role="img" aria-label="Comparison chart">
        {Array.from({ length: levels }, (_, l) => (
          <polygon key={l} points={axes.map((_, i) => point(i, (l + 1) / levels).join(',')).join(' ')}
            fill="none" className="stroke-ink-100" strokeWidth="1" />
        ))}
        {axes.map((ax, i) => {
          const [x, y] = point(i, 1)
          const [lx, ly] = point(i, 1.16)
          return (
            <g key={ax.key}>
              <line x1={c} y1={c} x2={x} y2={y} className="stroke-ink-100" strokeWidth="1" />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="fill-ink-500 text-[9px]">{ax.label}</text>
            </g>
          )
        })}
        {series.map((s, i) => (
          <g key={i} className={s.className || tones[i % tones.length]}>
            <polygon points={poly(s.values)} fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            {axes.map((ax, j) => {
              const [x, y] = point(j, Math.max(0, Math.min(1, (s.values[ax.key] || 0) / max)))
              return <circle key={ax.key} cx={x} cy={y} r="2.5" fill="currentColor" />
            })}
          </g>
        ))}
      </svg>
      {series.length > 0 && (
        <ul className="min-w-0 space-y-2">
          {series.map((s, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-ink-700">
              <span className={cx('h-2.5 w-2.5 rounded-full bg-current', s.className || tones[i % tones.length])} />{s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
