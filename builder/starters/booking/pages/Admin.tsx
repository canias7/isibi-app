import { useState } from 'react'
import DashboardShell from '../components/DashboardShell.tsx'
import StatRow from '../components/StatRow.tsx'
import DataTable from '../components/DataTable.tsx'
import Modal from '../components/Modal.tsx'
import ConfirmDialog from '../components/ConfirmDialog.tsx'
import Button from '../components/Button.tsx'
import Input from '../components/Input.tsx'
import Textarea from '../components/Textarea.tsx'
import Switch from '../components/Switch.tsx'
import Alert from '../components/Alert.tsx'
import Badge from '../components/Badge.tsx'
import EmptyState from '../components/EmptyState.tsx'
import { FormSection, FormActions } from '../components/FormSection.tsx'
import { useResource } from '../lib/useResource.ts'
import { useAuth } from '../lib/auth.tsx'
import { Scissors, Clock, DollarSign, ShieldAlert } from 'lucide-react'

// Number fields are held as STRINGS while editing — an <input type=number> hands back a string, and coercing
// on every keystroke makes the field impossible to clear. They are coerced once, on save.
const blank = { name: '', description: '', duration_min: '30', price: '0', active: true }

// Owner console. It manages the SERVICE LIST — the one thing an admin genuinely owns here. Bookings live on a
// `user` table, so each customer sees only their own and this page deliberately does not pretend otherwise.
export default function Admin() {
  const { user } = useAuth()
  const { data, loading, error, saving, create, update, remove } = useResource('services')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blank)
  const [toDelete, setToDelete] = useState(null)
  const [formError, setFormError] = useState('')

  const open = (row) => {
    setEditing(row || 'new')
    setForm(row ? { ...blank, ...row } : blank)
    setFormError('')
  }

  const save = async (e) => {
    e.preventDefault()
    setFormError('')
    const body = {
      name: form.name.trim(),
      description: (form.description || '').trim(),
      duration_min: Number(form.duration_min) || 30,
      price: Number(form.price) || 0,
      active: !!form.active,
    }
    if (!body.name) return setFormError('A service needs a name.')
    try {
      if (editing === 'new') await create(body)
      else await update(editing.id, body)
      setEditing(null)
    } catch (err) {
      setFormError(err.message || 'That could not be saved.')
    }
  }

  const isAdmin = user && user.role === 'admin'
  const activeCount = data.filter((s) => s.active !== false).length
  const avgMinutes = data.length ? Math.round(data.reduce((n, s) => n + (Number(s.duration_min) || 0), 0) / data.length) : 0
  const avgPrice = data.length ? data.reduce((n, s) => n + (Number(s.price) || 0), 0) / data.length : 0

  return (
    <DashboardShell
      title="Admin"
      description="Manage the services customers can book."
      actions={<Button onClick={() => open(null)} disabled={!isAdmin}>New service</Button>}
    >
      {!isAdmin ? (
        <Alert tone="warning" title="Admins only" className="mb-6">
          You can see this page, but the server will reject any change unless your account has the admin role.
        </Alert>
      ) : null}

      {error ? <Alert tone="danger" className="mb-6">{error.message}</Alert> : null}

      <StatRow
        columns={3}
        stats={[
          { label: 'Bookable services', value: activeCount, icon: <Scissors size={16} /> },
          { label: 'Average length', value: avgMinutes ? `${avgMinutes} min` : '—', icon: <Clock size={16} /> },
          { label: 'Average price', value: avgPrice ? '$' + avgPrice.toFixed(0) : '—', icon: <DollarSign size={16} /> },
        ]}
      />

      {!loading && !data.length ? (
        <EmptyState
          icon={ShieldAlert}
          title="No services yet"
          description="Add the first one and it appears on the site immediately."
          actionLabel="New service"
          onAction={() => open(null)}
          className="mt-8"
        />
      ) : (
        <DataTable
          className="mt-6"
          loading={loading}
          rows={data}
          onRowClick={open}
          columns={[
            { key: 'name', header: 'Service', sortable: true },
            { key: 'duration_min', header: 'Length', render: (r) => `${r.duration_min || 30} min` },
            { key: 'price', header: 'Price', align: 'right', render: (r) => (Number(r.price) ? '$' + Number(r.price).toFixed(2) : '—') },
            { key: 'active', header: 'Status', render: (r) => <Badge tone={r.active === false ? 'neutral' : 'success'}>{r.active === false ? 'Hidden' : 'Bookable'}</Badge> },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (r) => <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setToDelete(r) }}>Delete</Button>,
            },
          ]}
        />
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'New service' : 'Edit service'}>
        <form onSubmit={save}>
          {formError ? <Alert tone="danger" className="mb-4">{formError}</Alert> : null}
          <FormSection>
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Textarea label="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-4" />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input label="Length (minutes)" type="number" min={5} step={5} value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} />
              <Input label="Price" type="number" min={0} step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <Switch className="mt-4" checked={!!form.active} onChange={(v) => setForm({ ...form, active: v })} label="Customers can book this" />
          </FormSection>
          <FormActions>
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" loading={saving} disabled={saving}>Save</Button>
          </FormActions>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => { await remove(toDelete.id); setToDelete(null) }}
        busy={saving}
        tone="danger"
        title="Delete this service?"
        message={toDelete ? `"${toDelete.name}" disappears from the site. Existing bookings keep their own copy of the name.` : ''}
        confirmLabel="Delete"
      />
    </DashboardShell>
  )
}
