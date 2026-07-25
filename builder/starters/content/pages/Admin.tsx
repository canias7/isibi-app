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
import { FileText, Eye, MessageSquare } from 'lucide-react'

const blank = { title: '', slug: '', excerpt: '', body: '', cover: '', category: '', author: '', read_minutes: '4', published: false }

const slugify = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 160)

export default function Admin() {
  const { user } = useAuth()
  const { data, loading, error, saving, create, update, remove } = useResource('posts')
  const { data: comments } = useResource('comments')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blank)
  const [toDelete, setToDelete] = useState(null)
  const [formError, setFormError] = useState('')

  const open = (row) => {
    setEditing(row || 'new')
    setForm(row ? { ...blank, ...row, read_minutes: String(row.read_minutes ?? '4') } : blank)
    setFormError('')
  }

  const save = async (e) => {
    e.preventDefault()
    setFormError('')
    const title = form.title.trim()
    // The slug is the article's address, so it is derived rather than asked for — but it stays editable, because
    // changing a published post's slug breaks every link to it and that has to be a deliberate act.
    const body = {
      title,
      slug: (form.slug || '').trim() || slugify(title),
      excerpt: (form.excerpt || '').trim(),
      body: form.body,
      cover: (form.cover || '').trim(),
      category: (form.category || '').trim(),
      author: (form.author || '').trim() || user?.display_name || '',
      read_minutes: Number(form.read_minutes) || 4,
      published: !!form.published,
    }
    if (!body.title) return setFormError('A post needs a title.')
    if (!body.body.trim()) return setFormError('A post needs a body.')
    const clash = data.find((p) => p.slug === body.slug && (editing === 'new' || p.id !== editing.id))
    if (clash) return setFormError(`Another post already uses the slug "${body.slug}".`)
    try {
      if (editing === 'new') await create(body)
      else await update(editing.id, body)
      setEditing(null)
    } catch (err) {
      setFormError(err.message || 'That could not be saved.')
    }
  }

  const isAdmin = user && user.role === 'admin'
  const published = data.filter((p) => p.published !== false)

  return (
    <DashboardShell
      title="Admin"
      description="Write, edit and publish."
      actions={<Button onClick={() => open(null)} disabled={!isAdmin}>New post</Button>}
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
          { label: 'Published', value: published.length, icon: <Eye size={16} /> },
          { label: 'Drafts', value: data.length - published.length, icon: <FileText size={16} /> },
          { label: 'Comments', value: comments.length, icon: <MessageSquare size={16} /> },
        ]}
      />

      {!loading && !data.length ? (
        <EmptyState
          icon={FileText}
          title="Nothing written yet"
          description="Start a draft — it stays hidden until you publish it."
          actionLabel="New post"
          onAction={() => open(null)}
          className="mt-8"
        />
      ) : (
        <DataTable
          className="mt-6"
          loading={loading}
          rows={[...data].sort((a, b) => (b.id || 0) - (a.id || 0))}
          onRowClick={open}
          columns={[
            { key: 'title', header: 'Title', sortable: true },
            { key: 'category', header: 'Topic', render: (r) => r.category || '—' },
            { key: 'created_at', header: 'Created', render: (r) => String(r.created_at || '').slice(0, 10) },
            { key: 'published', header: 'Status', render: (r) => <Badge tone={r.published ? 'success' : 'neutral'}>{r.published ? 'Published' : 'Draft'}</Badge> },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (r) => <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setToDelete(r) }}>Delete</Button>,
            },
          ]}
        />
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'New post' : 'Edit post'} size="xl">
        <form onSubmit={save}>
          {formError ? <Alert tone="danger" className="mb-4">{formError}</Alert> : null}
          <FormSection>
            <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: form.slug || slugify(e.target.value) })} required />
            <Input label="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} hint="The article's address. Changing it on a published post breaks existing links." className="mt-4" />
            <Textarea label="Standfirst" rows={2} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} hint="The one-line summary shown on cards." className="mt-4" />
            <Textarea label="Body" rows={14} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} hint="Blank line between paragraphs. Start a line with ## for a heading — those become the contents rail." className="mt-4" required />
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Input label="Topic" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <Input label="Author" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
              <Input label="Read time (min)" type="number" min={1} value={form.read_minutes} onChange={(e) => setForm({ ...form, read_minutes: e.target.value })} />
            </div>
            <Input label="Cover image URL" value={form.cover} onChange={(e) => setForm({ ...form, cover: e.target.value })} className="mt-4" />
            <Switch className="mt-4" checked={!!form.published} onChange={(v) => setForm({ ...form, published: v })} label="Published" hint="Drafts are invisible to readers." />
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
        title="Delete this post?"
        message={toDelete ? `"${toDelete.title}" and its link disappear. Comments on it are left behind.` : ''}
        confirmLabel="Delete"
      />
    </DashboardShell>
  )
}
