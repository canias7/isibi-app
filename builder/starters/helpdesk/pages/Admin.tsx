import { useMemo, useState } from 'react'
import DashboardShell from '../components/DashboardShell.tsx'
import Tabs from '../components/Tabs.tsx'
import StatRow from '../components/StatRow.tsx'
import DataTable from '../components/DataTable.tsx'
import TopList from '../components/TopList.tsx'
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
import { SLA_MINUTES, minutesLeft, isLive } from '../lib/desk.ts'
import { BookOpen, AlarmClock, Inbox, CheckCircle2 } from 'lucide-react'

const blank = { title: '', summary: '', body: '', category: '', published: true }

export default function Admin() {
  const { user } = useAuth()
  const articles = useResource('articles')
  const { data: tickets, loading: ticketsLoading } = useResource('tickets')
  const [tab, setTab] = useState('articles')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blank)
  const [toDelete, setToDelete] = useState(null)
  const [formError, setFormError] = useState('')

  const isAdmin = user && user.role === 'admin'

  const stats = useMemo(() => {
    const live = tickets.filter(isLive)
    const breached = live.filter((t) => { const m = minutesLeft(t); return m != null && m < 0 })
    const resolved = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed')
    return { live: live.length, breached: breached.length, resolved: resolved.length, met: tickets.length ? Math.round(((tickets.length - breached.length) / tickets.length) * 100) : null }
  }, [tickets])

  const byCategory = useMemo(() => {
    const counts = new Map()
    for (const t of tickets) counts.set(t.category || 'Uncategorised', (counts.get(t.category || 'Uncategorised') || 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))
  }, [tickets])

  const open = (row) => { setEditing(row || 'new'); setForm(row ? { ...blank, ...row } : blank); setFormError('') }

  const save = async (e) => {
    e.preventDefault()
    setFormError('')
    const body = {
      title: form.title.trim(),
      summary: (form.summary || '').trim(),
      body: form.body,
      category: (form.category || '').trim(),
      published: !!form.published,
    }
    if (!body.title) return setFormError('A guide needs a title.')
    if (!body.body.trim()) return setFormError('A guide needs a body.')
    try {
      if (editing === 'new') await articles.create(body)
      else await articles.update(editing.id, body)
      setEditing(null)
    } catch (err) {
      setFormError(err.message || 'That could not be saved.')
    }
  }

  return (
    <DashboardShell
      title="Admin"
      description="Guides, and how the desk is holding up."
      actions={tab === 'articles' ? <Button onClick={() => open(null)} disabled={!isAdmin}>New guide</Button> : null}
    >
      {!isAdmin ? (
        <Alert tone="warning" title="Admins only" className="mb-6">
          You can see this page, but the server rejects any change to the knowledge base unless your account has
          the admin role.
        </Alert>
      ) : null}

      <StatRow
        columns={4}
        stats={[
          { label: 'Open tickets', value: ticketsLoading ? '—' : stats.live, icon: <Inbox size={16} /> },
          { label: 'Past target', value: ticketsLoading ? '—' : stats.breached, icon: <AlarmClock size={16} />, hint: `${SLA_MINUTES / 60}h to first reply` },
          { label: 'Resolved', value: ticketsLoading ? '—' : stats.resolved, icon: <CheckCircle2 size={16} /> },
          { label: 'Published guides', value: articles.loading ? '—' : articles.data.filter((a) => a.published !== false).length, icon: <BookOpen size={16} /> },
        ]}
      />

      <Alert tone="info" className="mt-6">
        Ticket figures cover your own tickets and your downline's — visibility follows the reporting line, not the
        admin role. Set who reports to whom from the isibi dashboard.
      </Alert>

      <Tabs className="mt-6" value={tab} onChange={setTab} tabs={[{ id: 'articles', label: 'Knowledge base', count: articles.data.length }, { id: 'volume', label: 'Ticket volume' }]} />

      {tab === 'volume' ? (
        <TopList
          className="mt-6"
          title="Tickets by category"
          items={byCategory}
          valueLabel="tickets"
          total={tickets.length}
          showShare
          emptyText="No tickets yet — this fills in as the desk gets used."
        />
      ) : articles.error ? (
        <Alert tone="danger" className="mt-6">{articles.error.message}</Alert>
      ) : !articles.loading && !articles.data.length ? (
        <EmptyState
          icon={BookOpen}
          title="No guides yet"
          description="The cheapest ticket is the one nobody has to raise. Write the answer to whatever you get asked most."
          actionLabel="New guide"
          onAction={() => open(null)}
          className="mt-8"
        />
      ) : (
        <DataTable
          className="mt-6"
          loading={articles.loading}
          rows={articles.data}
          onRowClick={open}
          columns={[
            { key: 'title', header: 'Guide', sortable: true },
            { key: 'category', header: 'Category', render: (r) => r.category || '—' },
            { key: 'updated_at', header: 'Updated', render: (r) => String(r.updated_at || r.created_at || '').slice(0, 10) },
            { key: 'published', header: 'Status', render: (r) => <Badge tone={r.published === false ? 'neutral' : 'success'}>{r.published === false ? 'Draft' : 'Live'}</Badge> },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (r) => <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setToDelete(r) }}>Delete</Button>,
            },
          ]}
        />
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'New guide' : 'Edit guide'} size="xl">
        <form onSubmit={save}>
          {formError ? <Alert tone="danger" className="mb-4">{formError}</Alert> : null}
          <FormSection>
            <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <Textarea label="Summary" rows={2} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} hint="The one line shown on the card and in search results." className="mt-4" />
            <Textarea label="Body" rows={14} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} hint="Blank line between paragraphs. Start a line with ## for a heading — those become the contents rail." className="mt-4" required />
            <Input label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-4" placeholder="Billing" />
            <Switch className="mt-4" checked={!!form.published} onChange={(v) => setForm({ ...form, published: v })} label="Published" hint="Drafts are invisible in the help centre." />
          </FormSection>
          <FormActions>
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" loading={articles.saving} disabled={articles.saving}>Save</Button>
          </FormActions>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => { await articles.remove(toDelete.id); setToDelete(null) }}
        busy={articles.saving}
        tone="danger"
        title="Delete this guide?"
        message={toDelete ? `"${toDelete.title}" disappears from the help centre. Any ticket that linked to it keeps the link, which will now 404.` : ''}
        confirmLabel="Delete"
      />
    </DashboardShell>
  )
}
