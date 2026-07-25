import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader.tsx'
import DataTable from '../components/DataTable.tsx'
import StatusPill from '../components/StatusPill.tsx'
import Drawer from '../components/Drawer.tsx'
import OrderTracker from '../components/OrderTracker.tsx'
import DescriptionList from '../components/DescriptionList.tsx'
import InvoiceTable from '../components/InvoiceTable.tsx'
import EmptyState from '../components/EmptyState.tsx'
import Button from '../components/Button.tsx'
import Alert from '../components/Alert.tsx'
import { useResource } from '../lib/useResource.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/cart.ts'
import { Package } from 'lucide-react'

const STAGES = ['pending', 'processing', 'shipped', 'completed']

// `items` is a json column, so it comes back either already parsed or as a string depending on the driver.
// Both are handled rather than assuming, because assuming is how a detail panel ends up blank in production.
function itemsOf(order) {
  const raw = order && order.items
  if (Array.isArray(raw)) return raw
  try { const p = JSON.parse(raw || '[]'); return Array.isArray(p) ? p : [] } catch { return [] }
}

export default function Orders() {
  const { user } = useAuth()
  const { data, loading, error } = useResource('orders')
  const [open, setOpen] = useState(null)

  if (!user) {
    return (
      <div className="container-page py-10">
        <PageHeader title="Your orders" />
        <Alert tone="info" className="mt-6" action={<Button as={Link} to="/signin" size="sm">Sign in</Button>}>
          Sign in to see your orders.
        </Alert>
      </div>
    )
  }

  const rows = [...data].sort((a, b) => (b.id || 0) - (a.id || 0))
  const lines = itemsOf(open)

  return (
    <div className="container-page py-10">
      <PageHeader title="Your orders" description="Everything you have bought, and where it has got to." />

      {error ? <Alert tone="danger" className="mt-6">{error.message}</Alert> : null}

      {!loading && !rows.length ? (
        <EmptyState
          icon={Package}
          title="No orders yet"
          description="When you buy something it will show up here with its tracking."
          actionLabel="Start shopping"
          actionAs={Link}
          actionTo="/shop"
          className="mt-10"
        />
      ) : (
        <DataTable
          className="mt-6"
          loading={loading}
          rows={rows}
          onRowClick={setOpen}
          columns={[
            { key: 'reference', header: 'Order', render: (r) => <span className="font-medium text-ink-900">{r.reference || `#${r.id}`}</span> },
            { key: 'created_at', header: 'Placed', sortable: true, render: (r) => String(r.created_at || '').slice(0, 10) },
            { key: 'items', header: 'Items', render: (r) => itemsOf(r).reduce((n, i) => n + (i.quantity || 1), 0) },
            { key: 'total', header: 'Total', align: 'right', render: (r) => money(r.total) },
            { key: 'status', header: 'Status', render: (r) => <StatusPill status={r.status || 'pending'} /> },
          ]}
        />
      )}

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open ? (open.reference || `Order #${open.id}`) : ''}>
        {open ? (
          <div className="space-y-8">
            <OrderTracker
              steps={STAGES.map((s) => ({ label: s.charAt(0).toUpperCase() + s.slice(1) }))}
              current={Math.max(0, STAGES.indexOf(open.status || 'pending'))}
              failed={open.status === 'cancelled'}
            />

            <InvoiceTable
              lines={lines.map((i) => ({ description: i.title, qty: i.quantity, unitPrice: money(i.price), amount: money((i.price || 0) * (i.quantity || 1)) }))}
              totals={[
                { label: 'Subtotal', value: money(open.subtotal) },
                { label: 'Delivery', value: open.shipping ? money(open.shipping) : 'Free' },
              ]}
              total={money(open.total)}
            />

            <DescriptionList
              items={[
                { label: 'Ship to', value: open.ship_name },
                { label: 'Address', value: [open.ship_address, open.ship_city, open.ship_postcode].filter(Boolean).join(', ') },
                { label: 'Email', value: open.email },
                { label: 'Placed', value: String(open.created_at || '').slice(0, 16).replace('T', ' ') },
              ]}
            />
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}
