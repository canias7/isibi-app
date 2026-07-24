import { cx } from '../lib/cx.js'

// ScatterPlot — correlation between two measures, with optional bubble sizing and series colours.
// points: [{x, y, r, label, series}]. Pure SVG, no dependency, axes derived from the data.
export default function ScatterPlot({
  points = [], height = 260, xLabel, yLabel, series = [], grid = true, onSelect, className,
}) {
  if (!points.length) return null
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y)
  const pad = (lo, hi) => { const d = (hi - lo) || 1; return [lo - d * 0.08, hi + d * 0.08] }
  const [x0, x1] = pad(Math.min(...xs), Math.max(...xs))
  const [y0, y1] = pad(Math.min(...ys, 0), Math.max(...ys))
  const px = (v) => ((v - x0) / (x1 - x0)) * 100
  const py = (v) => 100 - ((v - y0) / (y1 - y0)) * 100
  const tones = ['text-brand-500', 'text-accent-500', 'text-emerald-500', 'text-sky-500', 'text-rose-400']
  const toneOf = (s) => { const i = series.indexOf(s); return tones[(i < 0 ? 0 : i) % tones.length] }
  const ticks = [0, 25, 50, 75, 100]
  return (
    <div className={className}>
      <div className="flex gap-2">
        {yLabel && (
          // Rotated axis labels need a fixed-width column, or the chart jumps around as the label length changes.
          <span className="flex w-4 shrink-0 items-center justify-center text-[11px] text-ink-400"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{yLabel}</span>
        )}
        <div className="relative min-w-0 flex-1" style={{ height }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
            {grid && ticks.map((t) => (
              <g key={t}>
                <line x1="0" y1={t} x2="100" y2={t} className="stroke-ink-100" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
                <line x1={t} y1="0" x2={t} y2="100" className="stroke-ink-100" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
              </g>
            ))}
          </svg>
          {/* Dots are absolutely-positioned DOM nodes, not SVG circles: a non-uniform viewBox would squash
              them into ellipses, and this way each one can be a real focusable button. */}
          {points.map((p, i) => (
            <button key={i} type="button" disabled={!onSelect} onClick={() => onSelect && onSelect(p)}
              title={p.label ? `${p.label}: ${p.x}, ${p.y}` : `${p.x}, ${p.y}`}
              aria-label={p.label || `Point ${i + 1}`}
              className={cx('absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-current opacity-70 transition',
                toneOf(p.series), onSelect && 'hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500')}
              style={{ left: `${px(p.x)}%`, top: `${py(p.y)}%`, width: p.r ? `${p.r}px` : '9px', height: p.r ? `${p.r}px` : '9px' }} />
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-4 pl-6 text-[11px] tabular-nums text-ink-400">
        <span>{Math.round(x0)}</span>
        {xLabel && <span className="text-ink-500">{xLabel}</span>}
        <span>{Math.round(x1)}</span>
      </div>
      {series.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-4">
          {series.map((s) => (
            <li key={s} className="inline-flex items-center gap-1.5 text-xs text-ink-600">
              <span className={cx('h-2.5 w-2.5 rounded-full bg-current', toneOf(s))} />{s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
