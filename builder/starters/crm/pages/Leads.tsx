import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader.tsx'
import SearchFilterBar from '../components/SearchFilterBar.tsx'
import DataTable from '../components/DataTable.tsx'
import StatusPill from '../components/StatusPill.tsx'
import Drawer from '../components/Drawer.tsx'
import Modal from '../components/Modal.tsx'
import ConfirmDialog from '../components/ConfirmDialog.tsx'
import DescriptionList from '../components/DescriptionList.tsx'
import Button from '../components/Button.tsx'
import Input from '../components/Input.tsx'
import Select from '../components/Select.tsx'
import Textarea from '../components/Textarea.tsx'
import Alert from '../components/Alert.tsx'
import EmptyState from '../components/EmptyState.tsx'
import { FormSection, FormActions } from '../components/FormSection.tsx'
import { useResource } from '../lib/useResource.ts'
import { useAuth } from '../lib/auth.tsx'
import { LEAD_SOURCES, LEAD_STATUSES, money } from '../lib/pipeline.ts'
import type { LeadSource, LeadStatus } from '../lib/pipeline.ts'
import { UserPlus } from 'lucide-react'

// Number fields are held as strings while editing — <input type="number"> hands back a string and coercing on
// every keystroke makes the field impossible to clear. Coerced once, on save.
const blank = { name: '', company: '', email: '', phone: '', source: 'website' as LeadSource, status: 'new' as LeadStatus, value: '', notes: '' }

// The server enforces these moves (schema `transitions`), so offering an illegal one just produces a 400 the
// user cannot act on. The dropdown shows only what will actually be accepted.
const NEXT = {
  new: ['new', 'contacted', 'unqualified'],
  contacted: ['contacted', 'qualified', 'unqualified'],
  qualified: ['qualified', 'contacted'],
  unqualified: ['unqualified', 'new'],
}

export default function Leads() {
  const { user } = useAuth()
  const { data, loading, error, saving, create, update, remove } = useResource('leads')
  const { create: createDeal } = useResource('deals')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [open, setOpen] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blank)
  const [toDelete, setToDelete] = useState(null)
  const [formError, setFormError] = useState('')
  const [note, setNote] = useState('')

  // A <Modal> renders nothing when closed, but its CHILDREN are still evaluated — so anything reading
  // `editing.x` crashes the page the moment the modal is shut. Resolve the options before the JSX.
  const statusChoices = editing && editing !== 'new' ? (NEXT[editing.status] || LEAD_STATUSES) : LEAD_STATUSES

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.filter((l) =>
      (!status || l.status === status) &&
      (!q || [l.name, l.company, l.email].some((v) => String(v || '').toLowerCase().includes(q)))
    )
  }, [data, query, status])

  const startEdit = (row) => {
    setEditing(row || 'new')
    setForm(row ? { ...blank, ...row, value: String(row.value ?? '') } : blank)
    setFormError('')
  }

  const save = async (e) => {
    e.preventDefault()
    setFormError('')
    const body = {
      name: form.name.trim(),
      company: (form.company || '').trim(),
      email: (form.email || '').trim(),
      phone: (form.phone || '').trim(),
      source: form.source,
      status: form.status,
      value: Number(form.value) || 0,
      notes: (form.notes || '').trim(),
    }
    if (!body.name) return setFormError('A lead needs a name.')
    try {
      if (editing === 'new') await create(body)
      else await update(editing.id, body)
      setEditing(null)
      setOpen(null)
    } catch (err) {
      setFormError(err.message || 'That could not be saved.')
    }
  }

  const moveStatus = async (row, next) => {
    try { await update(row.id, { status: next }); setOpen({ ...row, status: next }) } catch (err) { setNote(err.message || 'That move was rejected.') }
  }

  // Converting is deliberately a COPY, not a move: the lead stays as the record of where the deal came from,
  // which is the only way source attribution survives the handover.
  const convert = async (row) => {
    setNote('')
    try {
      await createDeal({ title: `${row.company || row.name} — new business`, company: row.company || '', value: Number(row.value) || 0, stage: 'discovery', probability: 20 })
      await update(row.id, { status: 'qualified' })
      setOpen(null)
      setNote(`Deal created from ${row.name}. It is in Discovery on the pipeline.`)
    } catch (err) {
      setNote(err.message || 'The deal could not be created.')
    }
  }

  if (!user) {
    return (
      <div className="container-page py-10">
        <PageHeader title="Leads" />
        <Alert tone="info" className="mt-6" action={<Button as={Link} to="/signin" size="sm">Sign in</Button>}>
          Sign in to see your leads.
        </Alert>
      </div>
    )
  }

  return (
    <div className="container-page py-10">
      <PageHeader
        title="Leads"
        description="Everything that came in, and who is working it."
        actions={<Button onClick={() => startEdit(null)}>New lead</Button>}
      />

      {error ? <Alert tone="danger" className="mt-6">{error.message}</Alert> : null}
      {note ? <Alert tone="info" className="mt-6" onDismiss={() => setNote('')}>{note}</Alert> : null}

      <SearchFilterBar
        className="mt-6"
        query={query}
        onQueryChange={setQuery}
        placeholder="Search name, company or email…"
        trailing={
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="">All statuses</option>
            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        }
      />

      {!loading && !shown.length ? (
        <EmptyState
          icon={UserPlus}
          title={query || status ? 'Nothing matched' : 'No leads yet'}
          description={query || status ? 'Try a broader search or clear the status filter.' : 'Add the first one and it appears here immediately.'}
          actionLabel={query || status ? 'Clear filters' : 'New lead'}
          onAction={() => (query || status ? (setQuery(''), setStatus('')) : startEdit(null))}
          className="mt-12"
        />
      ) : (
        <DataTable
          className="mt-6"
          loading={loading}
          rows={shown}
          onRowClick={setOpen}
          columns={[
            { key: 'name', header: 'Name', sortable: true },
            { key: 'company', header: 'Company', render: (r) => r.company || '—' },
            { key: 'source', header: 'Source', render: (r) => r.source || '—' },
            { key: 'value', header: 'Value', align: 'right', render: (r) => (Number(r.value) ? money(r.value) : '—') },
            { key: 'status', header: 'Status', render: (r) => <StatusPill status={r.status || 'new'} /> },
          ]}
        />
      )}

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open ? open.name : ''} width="30rem">
        {open ? (
          <div className="space-y-6">
            <DescriptionList
              items={[
                { label: 'Company', value: open.company || '—' },
                { label: 'Email', value: open.email || '—' },
                { label: 'Phone', value: open.phone || '—' },
                { label: 'Source', value: open.source || '—' },
                { label: 'Value', value: Number(open.value) ? money(open.value) : '—' },
                { label: 'Added', value: String(open.created_at || '').slice(0, 10) },
              ]}
            />

            {open.notes ? <p className="whitespace-pre-wrap rounded-xl2 bg-ink-50 p-4 text-sm leading-relaxed text-ink-700">{open.notes}</p> : null}

            <Select
              label="Status"
              value={open.status || 'new'}
              onChange={(e) => moveStatus(open, e.target.value)}
              hint="Only the moves the server accepts are offered."
            >
              {(NEXT[open.status || 'new'] || LEAD_STATUSES).map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => convert(open)} disabled={saving || open.status === 'unqualified'}>Convert to deal</Button>
              <Button size="sm" variant="secondary" onClick={() => startEdit(open)}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => setToDelete(open)}>Delete</Button>
            </div>
          </div>
        ) : null}
      </Drawer>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'New lead' : 'Edit lead'} size="lg">
        <form onSubmit={save}>
          {formError ? <Alert tone="danger" className="mb-4">{formError}</Alert> : null}
          <FormSection>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <Input label="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input label="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Select label="Source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as LeadSource })}>
                {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as LeadStatus })}>
                {statusChoices.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              <Input label="Value" type="number" min={0} step={100} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </div>
            <Textarea label="Notes" rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-4" />
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
        onConfirm={async () => { await remove(toDelete.id); setToDelete(null); setOpen(null) }}
        busy={saving}
        tone="danger"
        title="Delete this lead?"
        message={toDelete ? `${toDelete.name} goes to the bin. Any deal already created from it stays.` : ''}
        confirmLabel="Delete"
      />
    </div>
  )
}
