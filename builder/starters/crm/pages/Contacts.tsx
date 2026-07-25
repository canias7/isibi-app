import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader.tsx'
import SearchFilterBar from '../components/SearchFilterBar.tsx'
import UserCard from '../components/UserCard.tsx'
import Drawer from '../components/Drawer.tsx'
import Modal from '../components/Modal.tsx'
import ConfirmDialog from '../components/ConfirmDialog.tsx'
import DescriptionList from '../components/DescriptionList.tsx'
import Button from '../components/Button.tsx'
import Input from '../components/Input.tsx'
import Textarea from '../components/Textarea.tsx'
import Alert from '../components/Alert.tsx'
import EmptyState from '../components/EmptyState.tsx'
import Skeleton from '../components/Skeleton.tsx'
import { FormSection, FormActions } from '../components/FormSection.tsx'
import { useResource } from '../lib/useResource.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/pipeline.ts'
import { Contact } from 'lucide-react'

const blank = { name: '', role: '', company: '', email: '', phone: '', notes: '' }

export default function Contacts() {
  const { user } = useAuth()
  const { data, loading, error, saving, create, update, remove } = useResource('contacts')
  const { data: deals } = useResource('deals')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blank)
  const [toDelete, setToDelete] = useState(null)
  const [formError, setFormError] = useState('')

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.filter((c) => !q || [c.name, c.company, c.email, c.role].some((v) => String(v || '').toLowerCase().includes(q)))
  }, [data, query])

  // Deals are matched by company rather than by a foreign key, because a rep entering a deal in a hurry fills in
  // the company name and skips the contact picker. Matching on what actually gets typed beats matching on what
  // should have been.
  const dealsFor = (c) => deals.filter((d) => d.company && c.company && d.company.toLowerCase() === c.company.toLowerCase())

  const startEdit = (row) => { setEditing(row || 'new'); setForm(row ? { ...blank, ...row } : blank); setFormError('') }

  const save = async (e) => {
    e.preventDefault()
    setFormError('')
    const body = {
      name: form.name.trim(),
      role: (form.role || '').trim(),
      company: (form.company || '').trim(),
      email: (form.email || '').trim(),
      phone: (form.phone || '').trim(),
      notes: (form.notes || '').trim(),
    }
    if (!body.name) return setFormError('A contact needs a name.')
    try {
      if (editing === 'new') await create(body)
      else await update(editing.id, body)
      setEditing(null)
      setOpen(null)
    } catch (err) {
      setFormError(err.message || 'That could not be saved.')
    }
  }

  if (!user) {
    return (
      <div className="container-page py-10">
        <PageHeader title="Contacts" />
        <Alert tone="info" className="mt-6" action={<Button as={Link} to="/signin" size="sm">Sign in</Button>}>
          Sign in to see your contacts.
        </Alert>
      </div>
    )
  }

  return (
    <div className="container-page py-10">
      <PageHeader
        title="Contacts"
        description="The people behind the deals."
        actions={<Button onClick={() => startEdit(null)}>New contact</Button>}
      />

      {error ? <Alert tone="danger" className="mt-6">{error.message}</Alert> : null}

      <SearchFilterBar className="mt-6" query={query} onQueryChange={setQuery} placeholder="Search name, company or role…" />

      {loading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-44 w-full rounded-xl2" />)}</div>
      ) : !shown.length ? (
        <EmptyState
          icon={Contact}
          title={query ? 'Nothing matched' : 'No contacts yet'}
          description={query ? 'Try a shorter search.' : 'Add the people you are actually talking to.'}
          actionLabel={query ? 'Clear search' : 'New contact'}
          onAction={() => (query ? setQuery('') : startEdit(null))}
          className="mt-12"
        />
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((c) => (
            <UserCard
              key={c.id}
              name={c.name}
              role={[c.role, c.company].filter(Boolean).join(' · ')}
              bio={c.email || c.phone || undefined}
              stats={[{ label: 'Deals', value: dealsFor(c).length }]}
              onClick={() => setOpen(c)}
            />
          ))}
        </div>
      )}

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open ? open.name : ''} width="30rem">
        {open ? (
          <div className="space-y-6">
            <DescriptionList
              items={[
                { label: 'Role', value: open.role || '—' },
                { label: 'Company', value: open.company || '—' },
                { label: 'Email', value: open.email || '—' },
                { label: 'Phone', value: open.phone || '—' },
              ]}
            />

            {open.notes ? <p className="whitespace-pre-wrap rounded-xl2 bg-ink-50 p-4 text-sm leading-relaxed text-ink-700">{open.notes}</p> : null}

            <div>
              <h3 className="font-display text-sm font-semibold text-ink-900">Deals at {open.company || 'this company'}</h3>
              {dealsFor(open).length ? (
                <ul className="mt-3 divide-y divide-ink-100 rounded-xl2 border border-ink-100">
                  {dealsFor(open).map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <span className="min-w-0 truncate text-ink-800">{d.title}</span>
                      <span className="shrink-0 tabular-nums text-ink-600">{money(d.value)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-500">Nothing open. <Link to="/deals" className="text-brand-600 hover:underline">Add a deal</Link>.</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => startEdit(open)}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => setToDelete(open)}>Delete</Button>
            </div>
          </div>
        ) : null}
      </Drawer>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'New contact' : 'Edit contact'} size="lg">
        <form onSubmit={save}>
          {formError ? <Alert tone="danger" className="mb-4">{formError}</Alert> : null}
          <FormSection>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <Input label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Head of Operations" />
            </div>
            <Input label="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="mt-4" hint="Deals are matched to a contact by company name." />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input label="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
        title="Delete this contact?"
        message={toDelete ? `${toDelete.name} goes to the bin. Their deals are not affected.` : ''}
        confirmLabel="Delete"
      />
    </div>
  )
}
