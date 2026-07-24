import { cx } from '../lib/cx.js'

// ListDetailLayout — the master/detail pattern (inbox, tickets, threads, records).
// On small screens it shows the detail when something is selected, else the list.
export default function ListDetailLayout({ list, detail, selected = false, listWidth = 'md:w-80', emptyDetail = 'Select an item to see its details.', className }) {
  return (
    <div className={cx('flex min-h-[60vh] gap-0 overflow-hidden rounded-xl2 border border-ink-100 bg-surface', className)}>
      <div className={cx('w-full shrink-0 overflow-y-auto border-r border-ink-100', listWidth, selected && 'hidden md:block')}>
        {list}
      </div>
      <div className={cx('min-w-0 flex-1 overflow-y-auto', !selected && 'hidden md:block')}>
        {selected ? detail : (
          <div className="grid h-full place-items-center p-10 text-center text-sm text-ink-400">{emptyDetail}</div>
        )}
      </div>
    </div>
  )
}
