import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader.tsx'
import DataTable from '../components/DataTable.tsx'
import StatusPill from '../components/StatusPill.tsx'
import ConfirmDialog from '../components/ConfirmDialog.tsx'
import EmptyState from '../components/EmptyState.tsx'
import Button from '../components/Button.tsx'
import Alert from '../components/Alert.tsx'
import Tabs from '../components/Tabs.tsx'
import { useResource } from '../lib/useResource.ts'
import { useAuth } from '../lib/auth.tsx'
import { CalendarDays } from 'lucide-react'

const today = () => new Date().toISOString().slice(0, 10)

export default function MyBookings() {
  const { user } = useAuth()
  const { data, loading, error, saving, update } = useResource('bookings')
  const [tab, setTab] = useState('upcoming')
  const [toCancel, setToCancel] = useState(null)

  const live = data.filter((b) => b.status !== 'cancelled')
  const upcoming = live.filter((b) => b.date >= today()).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const past = live.filter((b) => b.date < today()).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
  const cancelled = data.filter((b) => b.status === 'cancelled')
  const rows = tab === 'upcoming' ? upcoming : tab === 'past' ? past : cancelled

  const cancel = async () => {
    if (!toCancel) return
    await update(toCancel.id, { status: 'cancelled' })
    setToCancel(null)
  }

  if (!user) {
    return (
      <div className="container-page py-10">
        <PageHeader title="My bookings" />
        <Alert tone="info" className="mt-6" action={<Button as={Link} to="/signin" size="sm">Sign in</Button>}>
          Sign in to see your appointments.
        </Alert>
      </div>
    )
  }

  return (
    <div className="container-page py-10">
      <PageHeader
        title="My bookings"
        description="Everything you have booked, and everything you have had."
        actions={<Button as={Link} to="/book">Book another</Button>}
      />

      {error ? <Alert tone="danger" className="mt-6">{error.message}</Alert> : null}

      <Tabs
        className="mt-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
          { id: 'past', label: 'Past', count: past.length },
          { id: 'cancelled', label: 'Cancelled', count: cancelled.length },
        ]}
      />

      {!loading && !rows.length ? (
        <EmptyState
          icon={CalendarDays}
          title={tab === 'upcoming' ? 'Nothing booked yet' : `No ${tab} appointments`}
          description={tab === 'upcoming' ? 'Pick a service and a time and it will show up here.' : 'This list fills up as you go.'}
          actionLabel={tab === 'upcoming' ? 'Book an appointment' : undefined}
          actionAs={Link}
          actionTo="/book"
          className="mt-10"
        />
      ) : (
        <DataTable
          className="mt-6"
          loading={loading}
          rows={rows}
          columns={[
            { key: 'service_name', header: 'Service' },
            { key: 'date', header: 'Date', sortable: true },
            { key: 'time', header: 'Time' },
            { key: 'status', header: 'Status', render: (row) => <StatusPill status={row.status || 'confirmed'} /> },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (row) => (row.status === 'cancelled' || row.date < today() ? null : (
                <Button size="sm" variant="ghost" onClick={() => setToCancel(row)}>Cancel</Button>
              )),
            },
          ]}
        />
      )}

      <ConfirmDialog
        open={!!toCancel}
        onClose={() => setToCancel(null)}
        onConfirm={cancel}
        busy={saving}
        tone="danger"
        title="Cancel this appointment?"
        message={toCancel ? `${toCancel.service_name} on ${toCancel.date} at ${toCancel.time}. The slot goes back to whoever wants it.` : ''}
        confirmLabel="Yes, cancel it"
        cancelLabel="Keep it"
      />
    </div>
  )
}
