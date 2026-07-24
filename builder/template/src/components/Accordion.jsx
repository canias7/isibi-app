import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cx } from '../lib/cx.js'

export default function Accordion({ items = [], allowMultiple = false, className }) {
  const [open, setOpen] = useState([])
  const toggle = (i) =>
    setOpen((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : allowMultiple ? [...cur, i] : [i]))
  return (
    <div className={cx('divide-y divide-ink-100 rounded-xl border border-ink-100 bg-surface', className)}>
      {items.map((item, i) => {
        const isOpen = open.includes(i)
        return (
          <div key={i}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => toggle(i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset"
            >
              <span className="text-sm font-medium text-ink-900">{item.title}</span>
              <ChevronDown size={16} className={cx('shrink-0 text-ink-400 transition-transform', isOpen && 'rotate-180')} />
            </button>
            {isOpen && <div className="px-5 pb-4 text-sm leading-relaxed text-ink-600">{item.content}</div>}
          </div>
        )
      })}
    </div>
  )
}
