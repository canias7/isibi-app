import { Plus } from 'lucide-react'
import { cx } from '../lib/cx.js'

interface StoryRingProps {
  items?: any[]
  onSelect?: (...args: any[]) => any
  onAdd?: (...args: any[]) => any
  addLabel?: string
  className?: string
}

// StoryRing — the horizontal row of circular story/highlight avatars. The gradient ring means unseen; a plain
// grey ring means already viewed. That single distinction is the whole interface.
// items: [{id, name, avatar, seen, live}]
export default function StoryRing({ items = [], onSelect, onAdd, addLabel = 'Add', className }: StoryRingProps) {
  return (
    <div className={cx('flex gap-4 overflow-x-auto pb-2', className)}>
      {onAdd && (
        <button type="button" onClick={onAdd}
          className="flex w-16 shrink-0 flex-col items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
          <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-ink-300 text-ink-400 transition hover:border-brand-400 hover:text-brand-500">
            <Plus size={20} />
          </span>
          <span className="w-full truncate text-center text-xs text-ink-500">{addLabel}</span>
        </button>
      )}
      {items.map((s) => (
        <button key={s.id} type="button" onClick={() => onSelect && onSelect(s)}
          className="flex w-16 shrink-0 flex-col items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
          {/* The ring is a padded gradient wrapper; the inner canvas-coloured ring is the gap that makes it read. */}
          <span className={cx('grid h-16 w-16 place-items-center rounded-full p-[2.5px] transition',
            s.live ? 'bg-rose-500'
              : s.seen ? 'bg-ink-200'
              : 'bg-gradient-to-tr from-accent-500 via-brand-500 to-brand-700')}>
            <span className="grid h-full w-full place-items-center rounded-full bg-canvas p-[2px]">
              {s.avatar
                ? <img src={s.avatar} alt="" className="h-full w-full rounded-full object-cover" />
                : <span className="grid h-full w-full place-items-center rounded-full bg-ink-100 text-sm font-semibold text-ink-500">{String(s.name || '?')[0]}</span>}
            </span>
          </span>
          <span className={cx('w-full truncate text-center text-xs', s.seen ? 'text-ink-400' : 'font-medium text-ink-700')}>
            {s.live ? 'LIVE' : s.name}
          </span>
        </button>
      ))}
    </div>
  )
}
