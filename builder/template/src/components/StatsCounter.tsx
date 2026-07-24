import { useEffect, useRef, useState } from 'react'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'
import type { StatItem } from '../lib/types.ts'

interface useCountUpProps {
  duration?: number
  decimals?: number
}

// useCountUp — animates 0 → target once the element scrolls into view. Exported so a page can count up
// anything (a hero figure, a KPI tile) without using the whole band.
export function useCountUp(target = 0, { duration = 1400, decimals = 0 }: useCountUpProps = {}) {
  const ref = useRef<any>(null)
  const [n, setN] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Respect reduced motion by jumping straight to the value — the number is the content, the count is decoration.
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || typeof IntersectionObserver === 'undefined') { setN(target); return }
    let raf, start
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      obs.disconnect()
      const tick = (t) => {
        if (!start) start = t
        const p = Math.min(1, (t - start) / duration)
        const eased = 1 - Math.pow(1 - p, 3) // ease-out cubic: fast then settling, never linear
        setN(Number((target * eased).toFixed(decimals)))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, { threshold: 0.3 })
    obs.observe(el)
    return () => { obs.disconnect(); if (raf) cancelAnimationFrame(raf) }
  }, [target, duration, decimals])
  return [ref, n]
}

function Counter({ value, prefix = '', suffix = '', decimals = 0, label, hint }) {
  const [ref, n] = useCountUp(value, { decimals })
  return (
    <div ref={ref as any} className="text-center">
      <p className="font-display text-4xl font-bold tabular-nums tracking-tight text-ink-900 sm:text-5xl">
        {prefix}{n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
      </p>
      <p className="mt-2 text-sm font-medium text-ink-700">{label}</p>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  )
}

interface StatsCounterProps {
  title?: ReactNode
  subtitle?: ReactNode
  stats?: any[]
  className?: string
}

// StatsCounter — the headline-numbers band that counts up on scroll. StatsBand is the static version; reach for
// this one when the numbers ARE the pitch.
export default function StatsCounter({ title, subtitle, stats = [], className }: StatsCounterProps) {
  return (
    <section className={cx('py-16', className)}>
      <div className="container-page">
        {(title || subtitle) && (
          <div className="mx-auto max-w-2xl text-center">
            {title && <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">{title}</h2>}
            {subtitle && <p className="mt-3 text-ink-600">{subtitle}</p>}
          </div>
        )}
        <div className={cx('mt-10 grid gap-8', stats.length >= 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3')}>
          {stats.map((s, i) => <Counter key={i} {...s} />)}
        </div>
      </div>
    </section>
  )
}
