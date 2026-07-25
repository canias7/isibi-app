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
import Badge from '../components/Badge.tsx'
import Alert from '../components/Alert.tsx'
import EmptyState from '../components/EmptyState.tsx'
import { FormSection, FormActions } from '../components/FormSection.tsx'
import { useResource } from '../lib/useResource.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/cart.ts'
import { Boxes, AlertTriangle, DollarSign } from 'lucide-react'

// Number fields are held as STRINGS while editing — <input type="number"> hands back a string, and coercing on
// every keystroke makes the field impossible to clear. They are coerced once, on save.
const blank = { title: '', description: '', price: '0', compare_price: '', image: '', category: '', stock: '0', active: true }

const LOW_STOCK = 5

export default function Admin() {
  const { user } = useAuth()
  const { data, loading, error, saving, create, update, remove } = useResource('products')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blank)
  const [toDelete, setToDelete] = useState(null)
  const [formError, setFormError] = useState('')

  const open = (row) => {
    setEditing(row || 'new')
    setForm(row ? { ...blank, ...row, price: String(row.price ?? ''), compare_price: String(row.compare_price ?? ''), stock: String(row.stock ?? '') } : blank)
    setFormError('')
  }

  const save = async (e) => {
    e.preventDefault()
    setFormError('')
    const body = {
      title: form.title.trim(),
      description: (form.description || '').trim(),
      price: Number(form.price) || 0,
      compare_price: form.compare_price === '' ? null : Number(form.compare_price) || 0,
      image: (form.image || '').trim(),
      category: (form.category || '').trim(),
      stock: Number(form.stock) || 0,
      active: !!form.active,
    }
    if (!body.title) return setFormError('A product needs a title.')
    if (!(body.price > 0)) return setFormError('Set a price above zero.')
    try {
      if (editing === 'new') await create(body)
      else await update(editing.id, body)
      setEditing(null)
    } catch (err) {
      setFormError(err.message || 'That could not be saved.')
    }
  }

  const isAdmin = user && user.role === 'admin'
  const live = data.filter((p) => p.active !== false)
  const lowStock = data.filter((p) => Number(p.stock) <= LOW_STOCK)
  const stockValue = data.reduce((n, p) => n + (Number(p.price) || 0) * (Number(p.stock) || 0), 0)

  return (
    <DashboardShell
      title="Admin"
      description="Manage the catalogue customers shop from."
      actions={<Button onClick={() => open(null)} disabled={!isAdmin}>New product</Button>}
    >
      {!isAdmin ? (
        <Alert tone="warning" title="Admins only" className="mb-6">
          You can see this page, but the server rejects any change unless your account has the admin role.
        </Alert>
      ) : null}

      {error ? <Alert tone="danger" className="mb-6">{error.message}</Alert> : null}

      <StatRow
        columns={3}
        stats={[
          { label: 'Live products', value: live.length, icon: <Boxes size={16} /> },
          { label: 'Low stock', value: lowStock.length, icon: <AlertTriangle size={16} />, hint: `${LOW_STOCK} or fewer left` },
          { label: 'Stock value', value: money(stockValue), icon: <DollarSign size={16} /> },
        ]}
      />

      {!loading && !data.length ? (
        <EmptyState
          icon={Boxes}
          title="No products yet"
          description="Add the first one and it appears in the shop immediately."
          actionLabel="New product"
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
            { key: 'title', header: 'Product', sortable: true },
            { key: 'category', header: 'Category', render: (r) => r.category || '—' },
            { key: 'price', header: 'Price', align: 'right', render: (r) => money(r.price) },
            {
              key: 'stock',
              header: 'Stock',
              align: 'right',
              render: (r) => <span className={Number(r.stock) <= LOW_STOCK ? 'font-medium text-rose-600' : undefined}>{r.stock ?? 0}</span>,
            },
            { key: 'active', header: 'Status', render: (r) => <Badge tone={r.active === false ? 'neutral' : 'success'}>{r.active === false ? 'Hidden' : 'Live'}</Badge> },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (r) => <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setToDelete(r) }}>Delete</Button>,
            },
          ]}
        />
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'New product' : 'Edit product'} size="lg">
        <form onSubmit={save}>
          {formError ? <Alert tone="danger" className="mb-4">{formError}</Alert> : null}
          <FormSection>
            <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <Textarea label="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-4" />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input label="Price" type="number" min={0} step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
              <Input label="Compare-at price" type="number" min={0} step="0.01" value={form.compare_price} onChange={(e) => setForm({ ...form, compare_price: e.target.value })} hint="Shown struck through. Leave blank for no sale." />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <Input label="Stock" type="number" min={0} step={1} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </div>
            <Input label="Image URL" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} className="mt-4" />
            <Switch className="mt-4" checked={!!form.active} onChange={(v) => setForm({ ...form, active: v })} label="Show this in the shop" />
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
        title="Delete this product?"
        message={toDelete ? `"${toDelete.title}" disappears from the shop. Past orders keep their own copy of the name and price.` : ''}
        confirmLabel="Delete"
      />
    </DashboardShell>
  )
}
