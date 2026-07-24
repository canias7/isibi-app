import { useEffect, useState } from 'react'
import { cx } from '../lib/cx.js'

// ReadingProgress — the thin bar at the very top that fills as you scroll an article. Measures the ARTICLE,
// not the window, when given a targetId, so the footer and comments don't count toward "finished reading".
export default function ReadingProgress({ targetId, height = 3, className }) {
  const [pct, setPct] = useState(0)
  useEffect(() => {
    const measure = () => {
      const el = targetId && document.getElementById(targetId)
      if (el) {
        const r = el.getBoundingClientRect()
        const total = r.height - window.innerHeight
        setPct(total <= 0 ? 100 : Math.max(0, Math.min(100, (-r.top / total) * 100)))
      } else {
        const total = document.documentElement.scrollHeight - window.innerHeight
        setPct(total <= 0 ? 0 : Math.max(0, Math.min(100, (window.scrollY / total) * 100)))
      }
    }
    measure()
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => { window.removeEventListener('scroll', measure); window.removeEventListener('resize', measure) }
  }, [targetId])
  return (
    <div className={cx('fixed inset-x-0 top-0 z-50 bg-transparent', className)} style={{ height }} aria-hidden="true">
      <div className="h-full bg-brand-500 transition-[width] duration-100" style={{ width: `${pct}%` }} />
    </div>
  )
}
