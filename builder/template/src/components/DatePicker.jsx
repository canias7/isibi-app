import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import Calendar from './Calendar.jsx'
import Popover from './Popover.jsx'
import { cx } from '../lib/cx.js'

// DatePicker — a text field that opens the month grid. value/onChange are 'YYYY-MM-DD'.
export default function DatePicker({ value, onChange, label, placeholder = 'Pick a date', minDate, marks, className }) {
  const [open, setOpen] = useState(false)
  const pretty = value ? new Date(value + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''
  return (
    <div className={className}>
      {label && <span className="mb-1.5 block text-sm font-medium text-ink-800">{label}</span>}
      <Popover open={open} onOpenChange={setOpen} width="w-auto"
        trigger={
          <button type="button" className="flex w-full items-center gap-2 rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-left text-sm
            focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
            <CalendarDays size={16} className="shrink-0 text-ink-400" />
            <span className={cx(value ? 'text-ink-900' : 'text-ink-400')}>{pretty || placeholder}</span>
          </button>
        }>
        <Calendar value={value} minDate={minDate} marks={marks}
          onChange={(d) => { onChange && onChange(d); setOpen(false) }} className="border-0 shadow-none p-0" />
      </Popover>
    </div>
  )
}
