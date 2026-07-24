import { useState } from 'react'
import Calendar from './Calendar.jsx'
import TimeSlots from './TimeSlots.jsx'
import Button from './Button.jsx'
import { cx } from '../lib/cx.js'

// BookingWidget — the date + time + confirm flow for appointments/classes/tables.
// slotsFor(dateIso) should return the times available on that day.
export default function BookingWidget({ title = 'Book a time', price, slotsFor, marks, minDate, onConfirm, busy = false, className }) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const slots = date && slotsFor ? slotsFor(date) : []
  return (
    <div className={cx('card-surface p-5', className)}>
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
        {price && <span className="font-display text-lg font-semibold text-ink-900">{price}</span>}
      </div>
      <Calendar value={date} onChange={(d) => { setDate(d); setTime('') }} marks={marks} minDate={minDate}
        className="border-0 p-0 shadow-none" />
      {date && (
        <div className="mt-5 border-t border-ink-100 pt-4">
          <TimeSlots label="Available times" slots={slots} value={time} onChange={setTime} />
        </div>
      )}
      <Button className="mt-5 w-full" disabled={!date || !time || busy}
        onClick={() => onConfirm && onConfirm({ date, time })}>
        {busy ? 'Confirming…' : !date ? 'Pick a date' : !time ? 'Pick a time' : 'Confirm booking'}
      </Button>
    </div>
  )
}
