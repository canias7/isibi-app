import { cx } from '../lib/cx.js'

interface CardVisualProps {
  brand?: any
  last4?: any
  holder?: any
  expiry?: any
  tone?: 'ink' | 'brand' | 'accent' | 'steel'
  nickname?: any
  isDefault?: boolean
  onClick?: (...args: any[]) => any
  className?: string
}

// CardVisual — a payment card rendered as a card. Wallets, billing settings, checkout confirmations.
// Never render a full PAN: the component only ever shows the last four, by design.
export default function CardVisual({
  brand, last4, holder, expiry, tone = 'ink', nickname, isDefault, onClick, className,
}: CardVisualProps) {
  const tones = {
    ink: 'bg-gradient-to-br from-ink-800 to-ink-900 text-canvas',
    brand: 'bg-gradient-to-br from-brand-500 to-brand-700 text-brandfg',
    accent: 'bg-gradient-to-br from-accent-500 to-accent-700 text-brandfg',
    steel: 'bg-gradient-to-br from-slate-500 to-slate-700 text-white',
  }
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag {...(onClick ? { type: 'button', onClick } : {})}
      className={cx('relative flex aspect-[1.586/1] w-full max-w-sm flex-col justify-between overflow-hidden rounded-2xl p-5 text-left shadow-soft',
        tones[tone] || tones.ink,
        onClick && 'transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        className)}>
      {/* A soft highlight sweep — cheaper and more durable than a texture image. */}
      <span className="pointer-events-none absolute -right-8 -top-16 h-48 w-48 rounded-full bg-white/10" aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wider opacity-70">{nickname || 'Card'}</span>
        {isDefault && <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">Default</span>}
      </div>
      <div className="relative">
        {/* The chip: two stacked rounded rects read as a chip at any size without an asset. */}
        <span className="mb-4 block h-7 w-10 rounded-md bg-gradient-to-br from-amber-200/90 to-amber-400/70" aria-hidden="true" />
        <p className="font-mono text-lg tracking-[0.2em]">•••• •••• •••• {last4}</p>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider opacity-60">Card holder</p>
            <p className="truncate text-sm font-medium uppercase tracking-wide">{holder}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] uppercase tracking-wider opacity-60">Expires</p>
            <p className="text-sm font-medium tabular-nums">{expiry}</p>
          </div>
          {brand && <span className="shrink-0 font-display text-base font-bold italic tracking-tight opacity-90">{brand}</span>}
        </div>
      </div>
    </Tag>
  )
}
