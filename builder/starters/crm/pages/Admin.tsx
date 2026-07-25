import { useState } from 'react'
import DashboardShell from '../components/DashboardShell.tsx'
import Tabs from '../components/Tabs.tsx'
import DataTable from '../components/DataTable.tsx'
import StatRow from '../components/StatRow.tsx'
import Button from '../components/Button.tsx'
import Alert from '../components/Alert.tsx'
import EmptyState from '../components/EmptyState.tsx'
import ConfirmDialog from '../components/ConfirmDialog.tsx'
import { useResource } from '../lib/useResource.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/pipeline.ts'
import api from '../lib/api.js'
import { Trash2, Undo2, Copy } from 'lucide-react'

const TABLES = [
  { id: 'leads', label: 'Leads', title: (r) => r.name, sub: (r) => r.company },
  { id: 'deals', label: 'Deals', title: (r) => r.title, sub: (r) => (r.value ? money(r.value) : '') },
  { id: 'contacts', label: 'Contacts', title: (r) => r.name, sub: (r) => r.company },
]

// Workspace housekeeping. Deliberately NOT "manage everyone's records": leads, deals and contacts are `user`
// tables with teamRead, so visibility follows the reporting line and an admin role does not widen it. Pretending
// otherwise would render an empty table and look broken. What an admin genuinely owns is the bin and data
// hygiene, and that is what this page does.
export default function Admin() {
  const { user } = useAuth()
  const [tab, setTab] = useState('leads')
  const active = TABLES.find((t) => t.id === tab) || TABLES[0]

  // `trashed=1` asks the same endpoint for only the soft-deleted rows, so the bin needs no special plumbing.
  const bin = useResource(active.id, { params: { trashed: 1 } })
  const live = useResource(active.id)
  const [busyId, setBusyId] = useState(null)
  const [note, setNote] = useState('')
  const [toPurge, setToPurge] = useState(null)

  // Restore is a SUB-ACTION, not table I/O, so it goes through api directly — useResource does not wrap it.
  // The list is refetched by hand here for the same reason.
  const restore = async (row) => {
    setBusyId(row.id)
    setNote('')
    try {
      await api.post(`/rows/${active.id}/${row.id}/restore`, {}, { auth: true })
      bin.refetch()
      live.refetch()
      setNote(`Restored ${active.title(row) || 'the record'}.`)
    } catch (err) {
      setNote(err.message || 'That could not be restored.')
    } finally {
      setBusyId(null)
    }
  }

  // Same field, same value, two records. Cheap to compute here and it catches the duplicate a rep makes when a
  // lead comes in twice from two forms.
  const dupes = (() => {
    const seen = new Map()
    for (const r of live.data) {
      const key = String(r.email || r.title || r.name || '').trim().toLowerCase()
      if (!key) continue
      seen.set(key, (seen.get(key) || 0) + 1)
    }
    return [...seen.values()].filter((n) => n > 1).length
  })()

  return (
    <DashboardShell
      title="Admin"
      description="The bin and data hygiene for this workspace."
    >
      <Alert tone="info" title="What this page can and cannot see" className="mb-6">
        Leads, deals and contacts are owned by the rep who created them, and visibility follows the reporting
        line — you see your own records and your downline's, whatever your role. Set who reports to whom from the
        isibi dashboard.
      </Alert>

      {note ? <Alert tone="success" className="mb-6" onDismiss={() => setNote('')}>{note}</Alert> : null}

      <StatRow
        columns={3}
        stats={[
          { label: `Live ${active.label.toLowerCase()}`, value: live.loading ? '—' : live.data.length },
          { label: 'In the bin', value: bin.loading ? '—' : bin.data.length, icon: <Trash2 size={16} />, hint: 'Recoverable' },
          { label: 'Possible duplicates', value: live.loading ? '—' : dupes, icon: <Copy size={16} />, hint: 'Same email or title' },
        ]}
      />

      <Tabs className="mt-6" value={tab} onChange={setTab} tabs={TABLES.map((t) => ({ id: t.id, label: t.label }))} />

      {bin.error ? <Alert tone="danger" className="mt-6">{bin.error.message}</Alert> : null}

      {!bin.loading && !bin.data.length ? (
        <EmptyState
          icon={Trash2}
          title={`Nothing deleted`}
          description={`Deleted ${active.label.toLowerCase()} land here and can be put back. Nothing is removed for good until you purge it.`}
          className="mt-10"
        />
      ) : (
        <DataTable
          className="mt-6"
          loading={bin.loading}
          rows={bin.data}
          columns={[
            { key: 'title', header: active.label.replace(/s$/, ''), render: (r) => active.title(r) || `#${r.id}` },
            { key: 'sub', header: 'Detail', render: (r) => active.sub(r) || '—' },
            { key: 'deleted_at', header: 'Deleted', render: (r) => String(r.deleted_at || '').slice(0, 10) },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (r) => (
                <span className="flex justify-end gap-2">
                  <Button size="sm" variant="secondary" loading={busyId === r.id} disabled={busyId === r.id} onClick={() => restore(r)}>
                    <Undo2 size={14} />Restore
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setToPurge(r)}>Purge</Button>
                </span>
              ),
            },
          ]}
        />
      )}

      <ConfirmDialog
        open={!!toPurge}
        onClose={() => setToPurge(null)}
        onConfirm={async () => { await bin.remove(toPurge.id); setToPurge(null); bin.refetch() }}
        busy={bin.saving}
        tone="danger"
        title="Purge this record?"
        message={toPurge ? `${active.title(toPurge) || 'This record'} is already in the bin. Purging it is permanent — there is no second bin.` : ''}
        confirmLabel="Purge for good"
      />
    </DashboardShell>
  )
}
