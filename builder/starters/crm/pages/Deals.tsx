import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader.tsx'
import Kanban from '../components/Kanban.tsx'
import StatRow from '../components/StatRow.tsx'
import Modal from '../components/Modal.tsx'
import ConfirmDialog from '../components/ConfirmDialog.tsx'
import Button from '../components/Button.tsx'
import Input from '../components/Input.tsx'
import Select from '../components/Select.tsx'
import Textarea from '../components/Textarea.tsx'
import Badge from '../components/Badge.tsx'
import Alert from '../components/Alert.tsx'
import EmptyState from '../components/EmptyState.tsx'
import Skeleton from '../components/Skeleton.tsx'
import { FormSection, FormActions } from '../components/FormSection.tsx'
import { useResource } from '../lib/useResource.ts'
import { useAuth } from '../lib/auth.tsx'
import { STAGES, ALL_STAGES, money, shortMoney, weightedValue, winRate } from '../lib/pipeline.ts'
import { KanbanSquare, Trophy, XCircle } from 'lucide-react'

const blank = { title: '', company: '', value: '', stage: 'discovery', probability: '20', close_date: '', lost_reason: '' }

// Mirrors the schema's `transitions` block. The server rejects anything else with a 409, so the board and the
// stage dropdown only ever offer moves that will be accepted.
const ALLOWED = {
  discovery: ['proposal', 'lost'],
  proposal: ['negotiation', 'discovery', 'lost'],
  negotiation: ['won', 'lost', 'proposal'],
  won: [],
  lost: ['discovery'],
}

export default function Deals() {
  const { user } = useAuth()
  const { data, loading, error, saving, create, update, remove } = useResource('deals')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blank)
  const [toDelete, setToDelete] = useState(null)
  const [formError, setFormError] = useState('')
  const [note, setNote] = useState('')

  const openDeals = data.filter((d) => d.stage !== 'won' && d.stage !== 'lost')
  const won = data.filter((d) => d.stage === 'won')
  const lost = data.filter((d) => d.stage === 'lost')
  const rate = winRate(data)

  // A <Modal> renders nothing when closed, but its CHILDREN are still evaluated — so reading `editing.stage`
  // crashes the page the moment the modal is shut. Resolve the options before the JSX.
  const stageChoices = editing && editing !== 'new'
    ? [editing.stage, ...(ALLOWED[editing.stage] || [])]
    : ALL_STAGES.map((s) => s.id)

  const startEdit = (row) => {
    setEditing(row || 'new')
    setForm(row ? { ...blank, ...row, value: String(row.value ?? ''), probability: String(row.probability ?? ''), close_date: row.close_date || '', lost_reason: row.lost_reason || '' } : blank)
    setFormError('')
  }

  const save = async (e) => {
    e.preventDefault()
    setFormError('')
    const body = {
      title: form.title.trim(),
      company: (form.company || '').trim(),
      value: Number(form.value) || 0,
      stage: form.stage,
      probability: Math.max(0, Math.min(100, Number(form.probability) || 0)),
      close_date: form.close_date || '',
      lost_reason: form.stage === 'lost' ? (form.lost_reason || '').trim() : '',
    }
    if (!body.title) return setFormError('A deal needs a title.')
    if (!(body.value > 0)) return setFormError('Give the deal a value above zero — the forecast is built on it.')
    if (body.stage === 'lost' && !body.lost_reason) return setFormError('Record why it was lost. That is the whole point of tracking losses.')
    try {
      if (editing === 'new') await create(body)
      else await update(editing.id, body)
      setEditing(null)
    } catch (err) {
      setFormError(err.message || 'That could not be saved.')
    }
  }

  const move = async (id, stage) => {
    const deal = data.find((d) => String(d.id) === String(id))
    if (!deal || deal.stage === stage) return
    if (!(ALLOWED[deal.stage] || []).includes(stage)) {
      setNote(`A deal in ${deal.stage} cannot move straight to ${stage}.`)
      return
    }
    // Losing a deal without a reason is the single most common way pipeline data becomes useless, so the board
    // hands off to the form rather than performing the move silently.
    if (stage === 'lost') { startEdit({ ...deal, stage: 'lost' }); return }
    setNote('')
    const next = ALL_STAGES.find((s) => s.id === stage)
    try { await update(deal.id, { stage, probability: next ? next.probability : deal.probability }) } catch (err) { setNote(err.message || 'That move was rejected.') }
  }

  if (!user) {
    return (
      <div className="container-page py-10">
        <PageHeader title="Pipeline" />
        <Alert tone="info" className="mt-6" action={<Button as={Link} to="/signin" size="sm">Sign in</Button>}>
          Sign in to see the pipeline.
        </Alert>
      </div>
    )
  }

  return (
    <div className="container-page py-10">
      <PageHeader
        title="Pipeline"
        description="Drag a card to move the deal. Won and lost are recorded on the card itself."
        actions={<Button onClick={() => startEdit(null)}>New deal</Button>}
      />

      {error ? <Alert tone="danger" className="mt-6">{error.message}</Alert> : null}
      {note ? <Alert tone="warning" className="mt-6" onDismiss={() => setNote('')}>{note}</Alert> : null}

      <StatRow
        className="mt-6"
        columns={4}
        stats={[
          { label: 'Open', value: openDeals.length, icon: <KanbanSquare size={16} />, hint: shortMoney(openDeals.reduce((n, d) => n + (Number(d.value) || 0), 0)) },
          { label: 'Weighted', value: shortMoney(weightedValue(data)), hint: 'By each deal’s probability' },
          { label: 'Won', value: won.length, icon: <Trophy size={16} />, hint: shortMoney(won.reduce((n, d) => n + (Number(d.value) || 0), 0)) },
          { label: 'Lost', value: lost.length, icon: <XCircle size={16} />, hint: rate == null ? 'No closed deals yet' : `${rate}% win rate` },
        ]}
      />

      {loading ? (
        <div className="mt-8 grid gap-4 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-80 w-full rounded-xl2" />)}</div>
      ) : !data.length ? (
        <EmptyState
          icon={KanbanSquare}
          title="Nothing in the pipeline"
          description="Add a deal, or convert a qualified lead from the Leads page."
          actionLabel="New deal"
          onAction={() => startEdit(null)}
          className="mt-12"
        />
      ) : (
        <>
          <Kanban
            className="mt-8"
            columns={STAGES.map((s) => ({ id: s.id, title: s.title }))}
            items={openDeals.map((d) => ({ ...d, column: d.stage }))}
            onMove={move}
            summarize={(cards) => `${cards.length} deal${cards.length === 1 ? '' : 's'} · ${shortMoney(cards.reduce((n, c) => n + (Number(c.value) || 0), 0))}`}
            renderCard={(d) => (
              <button type="button" onClick={() => startEdit(d)} className="w-full text-left">
                <p className="font-medium text-ink-900">{d.title}</p>
                {d.company ? <p className="mt-0.5 text-xs text-ink-500">{d.company}</p> : null}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink-800">{money(d.value)}</span>
                  <Badge tone="neutral">{d.probability ?? 0}%</Badge>
                </div>
                {d.close_date ? <p className="mt-2 text-xs text-ink-400">Closes {d.close_date}</p> : null}
              </button>
            )}
          />

          {won.length || lost.length ? (
            <section className="mt-10">
              <h2 className="font-display text-lg font-semibold text-ink-900">Closed</h2>
              <div className="mt-3 divide-y divide-ink-100 rounded-xl2 border border-ink-100 bg-surface">
                {[...won, ...lost].map((d) => (
                  <button key={d.id} type="button" onClick={() => startEdit(d)} className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left hover:bg-ink-50">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink-900">{d.title}</span>
                      {d.stage === 'lost' && d.lost_reason ? <span className="block truncate text-xs text-ink-500">{d.lost_reason}</span> : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-sm tabular-nums text-ink-700">{money(d.value)}</span>
                      <Badge tone={d.stage === 'won' ? 'success' : 'danger'}>{d.stage}</Badge>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'New deal' : 'Edit deal'} size="lg">
        <form onSubmit={save}>
          {formError ? <Alert tone="danger" className="mb-4">{formError}</Alert> : null}
          <FormSection>
            <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input label="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              <Input label="Value" type="number" min={0} step={500} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Select
                label="Stage"
                value={form.stage}
                onChange={(e) => {
                  const next = ALL_STAGES.find((s) => s.id === e.target.value)
                  setForm({ ...form, stage: e.target.value, probability: next ? String(next.probability) : form.probability })
                }}
              >
                {stageChoices.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              <Input label="Probability %" type="number" min={0} max={100} step={5} value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} />
              <Input label="Close date" type="date" value={form.close_date} onChange={(e) => setForm({ ...form, close_date: e.target.value })} />
            </div>
            {form.stage === 'lost' ? (
              <Textarea label="Why was it lost?" rows={3} value={form.lost_reason} onChange={(e) => setForm({ ...form, lost_reason: e.target.value })} hint="Required. A loss with no reason teaches you nothing." className="mt-4" required />
            ) : null}
          </FormSection>
          <FormActions>
            {editing !== 'new' ? <Button type="button" variant="ghost" onClick={() => { setToDelete(editing); setEditing(null) }}>Delete</Button> : null}
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
        title="Delete this deal?"
        message={toDelete ? `"${toDelete.title}" goes to the bin and drops out of the forecast.` : ''}
        confirmLabel="Delete"
      />
    </div>
  )
}
