import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { Sparkline } from './Chart.tsx'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface AccountCardProps {
  name?: string
  type?: any
  balance?: any
  currency?: string
  available?: any
  number?: any
  trend?: any[]
  change?: any
  tone?: string
  actions?: ReactNode
  className?: string
}

// AccountCard — a balance summary: bank account, wallet, credit line, points balance. The hide-balance toggle
// is not decoration — people check balances in public and it's the first thing every banking app ships.
export default function AccountCard({
  name, type, balance, currency = '$', available, number, trend = [], change, tone = 'surface', actions, className,
}: AccountCardProps) {
  const [hidden, setHidden] = useState(false)
  const dark = tone === 'brand'
  const mask = (v) => (hidden ? '••••••' : v)
  return (
    <div className={cx('rounded-xl2 p-5', dark ? 'bg-brand-600 text-brandfg' : 'card-surface', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cx('text-sm font-medium', dark ? 'opacity-80' : 'text-ink-600')}>{name}</p>
          {type && <p className={cx('text-xs', dark ? 'opacity-60' : 'text-ink-400')}>{type}</p>}
        </div>
        <button type="button" onClick={() => setHidden((h) => !h)} aria-label={hidden ? 'Show balance' : 'Hide balance'}
          className={cx('shrink-0 rounded-lg p-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            dark ? 'text-brandfg/70 hover:bg-white/10 hover:text-brandfg' : 'text-ink-400 hover:bg-ink-100 hover:text-ink-700')}>
          {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      <p className={cx('mt-3 font-display text-3xl font-bold tabular-nums tracking-tight', dark ? '' : 'text-ink-900')}>
        <span className={cx('text-xl', dark ? 'opacity-70' : 'text-ink-400')}>{currency}</span>{mask(balance)}
      </p>
      <div className={cx('mt-1 flex flex-wrap items-center gap-x-4 text-xs', dark ? 'opacity-75' : 'text-ink-500')}>
        {available != null && <span className="tabular-nums">{currency}{mask(available)} available</span>}
        {change && <span className={cx('tabular-nums', dark ? '' : change.startsWith('-') ? 'text-rose-600' : 'text-emerald-600')}>{change}</span>}
      </div>
      {trend.length > 1 && <Sparkline data={trend} className={cx('mt-4 h-10', dark && 'text-brandfg/60')} />}
      {number && (
        <p className={cx('mt-4 font-mono text-xs', dark ? 'opacity-60' : 'text-ink-400')}>•••• {String(number).slice(-4)}</p>
      )}
      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
