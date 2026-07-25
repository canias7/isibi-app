import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader.tsx'
import BookingWidget from '../components/BookingWidget.tsx'
import ReservationSummary from '../components/ReservationSummary.tsx'
import Select from '../components/Select.tsx'
import Input from '../components/Input.tsx'
import Textarea from '../components/Textarea.tsx'
import Alert from '../components/Alert.tsx'
import Button from '../components/Button.tsx'
import { FormSection } from '../components/FormSection.tsx'
import { useResource, usePublicRows } from '../lib/useResource.ts'
import { useAuth } from '../lib/auth.tsx'

// Opening hours the slot grid is generated from. A real business overrides these; keeping them here rather
// than in the database means the page works on day one, before anyone has configured anything.
const OPEN_HOUR = 9
const CLOSE_HOUR = 17
const SLOT_MINUTES = 30

// slotsFor(dateIso) is what BookingWidget calls when a day is picked. Already-taken times are marked rather
// than hidden, because a grid that silently shrinks reads as broken.
function buildSlots(dateIso, taken) {
  const out = []
  for (let m = OPEN_HOUR * 60; m + SLOT_MINUTES <= CLOSE_HOUR * 60; m += SLOT_MINUTES) {
    const time = String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')
    out.push({ time, taken: taken.has(dateIso + ' ' + time) })
  }
  return out
}

export default function Book() {
  const { user } = useAuth()
  const { data: services } = useResource('services')
  const { saving, create } = useResource('bookings')
  // REAL availability. `bookings` is a `user` table, so reading it back only ever returns the caller's own rows —
  // which used to mean the grid could grey out slots THIS visitor had booked and nothing else. The table's
  // declared publicView returns {date, time} for every confirmed booking and nothing else, so a visitor sees
  // what is genuinely taken without ever seeing who took it.
  const { data: takenSlots } = usePublicRows('bookings')

  const [serviceId, setServiceId] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(null)

  const active = services.filter((s) => s.active !== false)
  const chosen = active.find((s) => String(s.id) === String(serviceId)) || null
  const taken = new Set(takenSlots.map((b) => b.date + ' ' + b.time))

  const confirm = async ({ date, time }) => {
    setError('')
    if (!chosen) return setError('Choose a service first.')
    if (!date || !time) return setError('Pick a day and a time.')
    const customer = name.trim() || user?.display_name || user?.email || ''
    if (!customer) return setError('Tell us who the booking is for.')
    try {
      await create({
        service_name: chosen.name,
        service_id: chosen.id,
        date,
        time,
        customer_name: customer,
        phone: phone.trim(),
        notes: notes.trim(),
        status: 'confirmed',
      })
      setConfirmed({ date, time, service: chosen.name, customer })
    } catch (err) {
      setError(err.message || 'That time could not be booked. Please pick another.')
    }
  }

  if (!user) {
    return (
      <div className="container-page py-10">
        <PageHeader title="Book an appointment" description="Sign in first so you can manage the booking afterwards." />
        <Alert tone="info" className="mt-6" action={<Button as={Link} to="/signin" size="sm">Sign in</Button>}>
          You need an account to book — it takes about twenty seconds and lets you cancel or rebook yourself.
        </Alert>
      </div>
    )
  }

  if (confirmed) {
    return (
      <div className="container-page max-w-2xl py-10">
        <PageHeader title="You're booked" description="We've saved it to your account." />
        <ReservationSummary
          className="mt-6"
          title={confirmed.service}
          status="confirmed"
          date={confirmed.date}
          time={confirmed.time}
          party={confirmed.customer}
          actions={
            <div className="flex gap-2">
              <Button as={Link} to="/my-bookings" size="sm">My bookings</Button>
              <Button size="sm" variant="secondary" onClick={() => setConfirmed(null)}>Book another</Button>
            </div>
          }
        />
      </div>
    )
  }

  return (
    <div className="container-page py-10">
      <PageHeader title="Book an appointment" description="Choose what you need, then pick a time." />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {error ? <Alert tone="danger" onDismiss={() => setError('')}>{error}</Alert> : null}

          <FormSection title="What do you need?" description="Length and price are shown once you choose.">
            <Select label="Service" value={serviceId} onChange={(e) => setServiceId(e.target.value)} required>
              <option value="">Choose a service…</option>
              {active.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.duration_min ? ` · ${s.duration_min} min` : ''}
                </option>
              ))}
            </Select>
          </FormSection>

          <FormSection title="Who is it for?" description="So we know who to expect.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder={user?.display_name || user?.email || ''} />
              <Input label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} hint="Only used if we need to reach you." />
            </div>
            <Textarea label="Anything we should know?" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-4" />
          </FormSection>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <BookingWidget
            title={chosen ? `Book ${chosen.name}` : 'Pick a time'}
            price={chosen && chosen.price ? '$' + Number(chosen.price).toFixed(0) : undefined}
            minDate={new Date().toISOString().slice(0, 10)}
            slotsFor={(dateIso) => buildSlots(dateIso, taken)}
            onConfirm={confirm}
            busy={saving}
          />
        </div>
      </div>
    </div>
  )
}
