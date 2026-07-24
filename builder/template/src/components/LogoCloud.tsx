import { cx } from '../lib/cx.js'

interface LogoCloudProps {
  label?: string
  logos?: any[]
  className?: string
}

// LogoCloud — "trusted by" strip. logos: strings (wordmarks) or nodes.
export default function LogoCloud({ label = 'Trusted by teams at', logos = [], className }: LogoCloudProps) {
  return (
    <section className={cx('border-y border-ink-100 bg-surface py-10', className)}>
      <div className="container-page flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
        {label && <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">{label}</p>}
        {logos.map((l, i) => (
          <span key={i} className="font-display text-sm font-semibold uppercase tracking-wide text-ink-500">{l}</span>
        ))}
      </div>
    </section>
  )
}
