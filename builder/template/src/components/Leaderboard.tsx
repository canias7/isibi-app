import Avatar from './Avatar.tsx'
import { cx } from '../lib/cx.js'

interface LeaderboardProps {
  title?: string
  entries?: any[]
  scoreLabel?: string
  highlightName?: any
  className?: string
}

// Leaderboard — ranked list for loyalty, referrals, community, challenges.
// entries: [{name, avatar, score, meta}]
export default function Leaderboard({ title = 'Leaderboard', entries = [], scoreLabel = 'pts', highlightName, className }: LeaderboardProps) {
  const medal = ['bg-accent-400 text-ink-900', 'bg-ink-300 text-ink-900', 'bg-accent-700 text-canvas']
  return (
    <div className={cx('card-surface overflow-hidden', className)}>
      <div className="border-b border-ink-100 px-5 py-4">
        <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
      </div>
      <ol className="divide-y divide-ink-100">
        {entries.map((e, i) => (
          <li key={i} className={cx('flex items-center gap-3 px-5 py-3', highlightName && e.name === highlightName && 'bg-brand-50')}>
            <span className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold',
              i < 3 ? medal[i] : 'bg-ink-100 text-ink-500')}>{i + 1}</span>
            <Avatar name={e.name} src={e.avatar} size="sm" className="shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink-900">{e.name}</span>
              {e.meta && <span className="block truncate text-xs text-ink-400">{e.meta}</span>}
            </span>
            <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-ink-900">
              {e.score}<span className="ml-1 text-xs font-normal text-ink-400">{scoreLabel}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
