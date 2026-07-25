import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader.tsx'
import ListDetailLayout from '../components/ListDetailLayout.tsx'
import TicketRow from '../components/TicketRow.tsx'
import SlaBadge from '../components/SlaBadge.tsx'
import StatusPill from '../components/StatusPill.tsx'
import SearchFilterBar from '../components/SearchFilterBar.tsx'
import ChatMessage from '../components/ChatMessage.tsx'
import ChatComposer from '../components/ChatComposer.tsx'
import Modal from '../components/Modal.tsx'
import Button from '../components/Button.tsx'
import Input from '../components/Input.tsx'
import Select from '../components/Select.tsx'
import Textarea from '../components/Textarea.tsx'
import Alert from '../components/Alert.tsx'
import Badge from '../components/Badge.tsx'
import EmptyState from '../components/EmptyState.tsx'
import Skeleton from '../components/Skeleton.tsx'
import { FormSection, FormActions } from '../components/FormSection.tsx'
import { useResource } from '../lib/useResource.ts'
import { useAuth } from '../lib/auth.tsx'
import { PRIORITIES, STATUSES, NEXT_STATUS, minutesLeft, queueOrder, ago, isLive, CANNED } from '../lib/desk.ts'
import type { Priority, TicketStatus } from '../lib/desk.ts'
import { Inbox } from 'lucide-react'

const blank = { subject: '', body: '', requester: '', requester_email: '', priority: 'normal' as Priority, category: '' }

export default function Tickets() {
  const { user } = useAuth()
  const { data, loading, error, saving, create, update } = useResource('tickets')
  const [selectedId, setSelectedId] = useState(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('live')
  const [composing, setComposing] = useState(false)
  const [form, setForm] = useState(blank)
  const [formError, setFormError] = useState('')
  const [note, setNote] = useState('')

  const selected = data.find((t) => String(t.id) === String(selectedId)) || null
  // Replies are fetched per ticket, so opening one costs a single small read rather than pulling every thread.
  const replies = useResource('replies', { params: { where: `ticket_id:eq:${selected ? selected.id : 0}` }, enabled: !!selected })

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data
      .filter((t) =>
        (filter === 'all' || (filter === 'live' ? isLive(t) : t.status === filter)) &&
        (!q || [t.subject, t.requester, t.reference].some((v) => String(v || '').toLowerCase().includes(q)))
      )
      .sort(queueOrder)
  }, [data, query, filter])

  const breached = data.filter((t) => { const m = minutesLeft(t); return m != null && m < 0 }).length

  const raise = async (e) => {
    e.preventDefault()
    setFormError('')
    const body = {
      subject: form.subject.trim(),
      body: form.body.trim(),
      requester: form.requester.trim() || user?.display_name || user?.email || '',
      requester_email: (form.requester_email || '').trim() || user?.email || '',
      priority: form.priority,
      category: (form.category || '').trim(),
      status: 'open' as TicketStatus,
    }
    if (!body.subject) return setFormError('Give the ticket a subject.')
    if (!body.body) return setFormError('Describe what happened — a subject on its own is not enough to act on.')
    if (!body.requester) return setFormError('Say who this is for.')
    try {
      // `reference` (TKT-0001) is assigned by the server from the schema's `sequence`, so it is deliberately
      // not sent — a client-generated number would collide the moment two agents raise a ticket at once.
      await create(body)
      setComposing(false)
      setForm(blank)
    } catch (err) {
      setFormError(err.message || 'That ticket could not be raised.')
    }
  }

  const moveStatus = async (next) => {
    if (!selected) return
    setNote('')
    try { await update(selected.id, { status: next }) } catch (err) { setNote(err.message || 'That move was rejected.') }
  }

  const reply = async (text, { internal = false } = {}) => {
    if (!selected || !text.trim()) return
    setNote('')
    try {
      await replies.create({ ticket_id: selected.id, author: user?.display_name || user?.email || 'Agent', body: text.trim(), internal })
      // Answering a ticket that was waiting on us moves it along — an agent should not have to remember to.
      if (selected.status === 'open') await update(selected.id, { status: 'pending' })
    } catch (err) {
      setNote(err.message || 'That reply could not be posted.')
    }
  }

  if (!user) {
    return (
      <div className="container-page py-10">
        <PageHeader title="Tickets" />
        <Alert tone="info" className="mt-6" action={<Button as={Link} to="/signin" size="sm">Sign in</Button>}>
          Sign in to raise a ticket or work the queue.
        </Alert>
      </div>
    )
  }

  const list = (
    <div>
      <SearchFilterBar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search subject, requester or TKT-…"
        trailing={
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter">
            <option value="live">Needs a reply</option>
            <option value="all">Everything</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        }
      />
      {loading ? (
        <div className="mt-4 space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl2" />)}</div>
      ) : !shown.length ? (
        <EmptyState
          icon={Inbox}
          title={query ? 'Nothing matched' : filter === 'live' ? 'Queue is clear' : 'No tickets'}
          description={query ? 'Try the reference, or a word from the subject.' : filter === 'live' ? 'Nothing is waiting on a reply. That is the goal.' : 'Raise one and it lands here.'}
          className="mt-8"
        />
      ) : (
        <div className="mt-4 divide-y divide-ink-100 rounded-xl2 border border-ink-100 bg-surface">
          {shown.map((t) => (
            <TicketRow
              key={t.id}
              id={t.reference || `#${t.id}`}
              subject={t.subject}
              preview={t.body}
              requester={t.requester}
              priority={t.priority || 'normal'}
              status={t.status || 'open'}
              updated={ago(t.updated_at || t.created_at)}
              selected={String(t.id) === String(selectedId)}
              onSelect={() => setSelectedId(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  )

  const detail = selected ? (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{selected.reference || `#${selected.id}`}</p>
          <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-ink-900">{selected.subject}</h2>
          <p className="mt-1 text-sm text-ink-500">
            {selected.requester}{selected.requester_email ? ` · ${selected.requester_email}` : ''} · raised {ago(selected.created_at)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SlaBadge minutesLeft={minutesLeft(selected)} met={!isLive(selected)} />
          <StatusPill status={selected.status || 'open'} />
        </div>
      </div>

      {note ? <Alert tone="warning" onDismiss={() => setNote('')}>{note}</Alert> : null}

      <div className="flex flex-wrap items-center gap-2">
        {(NEXT_STATUS[selected.status || 'open'] || []).map((s) => (
          <Button key={s} size="sm" variant={s === 'resolved' ? 'primary' : 'secondary'} onClick={() => moveStatus(s)} disabled={saving}>
            Mark {s}
          </Button>
        ))}
        {selected.category ? <Badge tone="neutral">{selected.category}</Badge> : null}
      </div>

      <div className="space-y-4">
        <ChatMessage author={selected.requester} body={selected.body} time={ago(selected.created_at)} />
        {replies.loading ? <Skeleton className="h-16 w-full rounded-xl2" /> : replies.data.map((r) => (
          <ChatMessage
            key={r.id}
            author={r.author + (r.internal ? ' · internal note' : '')}
            body={r.body}
            time={ago(r.created_at)}
            mine={!r.internal}
          />
        ))}
      </div>

      <div>
        <div className="mb-2 flex flex-wrap gap-2">
          {CANNED.map((c) => (
            <Button key={c.id} size="sm" variant="ghost" onClick={() => reply(c.body)} disabled={replies.saving}>{c.label}</Button>
          ))}
        </div>
        <ChatComposer onSend={(text) => reply(text)} busy={replies.saving} placeholder="Reply to the requester…" />
      </div>
    </div>
  ) : null

  return (
    <div className="container-page py-10">
      <PageHeader
        title="Tickets"
        description={breached ? `${breached} past the four-hour reply target — they are at the top of the queue.` : 'Sorted by what needs answering first.'}
        actions={<Button onClick={() => setComposing(true)}>New ticket</Button>}
      />

      {error ? <Alert tone="danger" className="mt-6">{error.message}</Alert> : null}

      <ListDetailLayout
        className="mt-6"
        list={list}
        detail={detail}
        selected={!!selected}
        listWidth="md:w-96"
        emptyDetail="Pick a ticket to read the thread."
      />

      <Modal open={composing} onClose={() => setComposing(false)} title="New ticket" size="lg">
        <form onSubmit={raise}>
          {formError ? <Alert tone="danger" className="mb-4">{formError}</Alert> : null}
          <FormSection>
            <Input label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
            <Textarea label="What happened?" rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} hint="What you did, what you expected, what you got instead." className="mt-4" required />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input label="Requester" value={form.requester} onChange={(e) => setForm({ ...form, requester: e.target.value })} placeholder={user?.display_name || user?.email || ''} />
              <Input label="Their email" type="email" value={form.requester_email} onChange={(e) => setForm({ ...form, requester_email: e.target.value })} placeholder={user?.email || ''} />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Select label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
              <Input label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Billing" />
            </div>
          </FormSection>
          <FormActions>
            <Button type="button" variant="secondary" onClick={() => setComposing(false)}>Cancel</Button>
            <Button type="submit" loading={saving} disabled={saving}>Raise ticket</Button>
          </FormActions>
        </form>
      </Modal>
    </div>
  )
}
