import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader.tsx'
import Breadcrumb from '../components/Breadcrumb.tsx'
import SearchFilterBar from '../components/SearchFilterBar.tsx'
import Prose from '../components/Prose.tsx'
import TableOfContents from '../components/TableOfContents.tsx'
import FeedbackWidget from '../components/FeedbackWidget.tsx'
import Callout from '../components/Callout.tsx'
import TagCloud from '../components/TagCloud.tsx'
import Button from '../components/Button.tsx'
import Alert from '../components/Alert.tsx'
import EmptyState from '../components/EmptyState.tsx'
import Skeleton from '../components/Skeleton.tsx'
import { Card, CardBody } from '../components/Card.tsx'
import { useResource } from '../lib/useResource.ts'
import { BookOpen, FileQuestion } from 'lucide-react'

// One page, two states: the index, and a single guide when ?id= is present. The router is generated from the
// page files that exist and has no dynamic segments, so a query parameter is the honest way to carry the id.
export default function KnowledgeBase() {
  const [params, setParams] = useSearchParams()
  const id = params.get('id')
  const { data, loading, error } = useResource('articles')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')

  const live = useMemo(() => data.filter((a) => a.published !== false), [data])
  const article = id ? live.find((a) => String(a.id) === String(id)) || null : null

  const categories = useMemo(() => {
    const counts = new Map()
    for (const a of live) if (a.category) counts.set(a.category, (counts.get(a.category) || 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count, onClick: () => setCategory(category === label ? '' : label) }))
  }, [live, category])

  const shown = live.filter((a) => {
    const q = query.trim().toLowerCase()
    return (!category || a.category === category) &&
      (!q || [a.title, a.summary, a.body].some((v) => String(v || '').toLowerCase().includes(q)))
  })

  const { blocks, toc } = useMemo(() => parseBody(article && article.body), [article])

  if (loading) {
    return <div className="container-page space-y-4 py-16"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-64 w-full rounded-xl2" /></div>
  }

  if (id && !article) {
    return (
      <div className="container-page py-16">
        <EmptyState
          icon={FileQuestion}
          title="We could not find that guide"
          description="It may have been unpublished, or the link may be out of date."
          actionLabel="Back to the knowledge base"
          actionAs={Link}
          actionTo="/knowledge-base"
        />
      </div>
    )
  }

  if (article) {
    return (
      <div className="container-page py-10">
        <PageHeader
          title={article.title}
          description={article.summary}
          breadcrumb={<Breadcrumb items={[{ label: 'Knowledge base', to: '/knowledge-base' }, { label: article.category || 'Guide' }]} />}
          actions={<Button as={Link} to="/tickets" variant="secondary">Still stuck? Raise a ticket</Button>}
        />

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="min-w-0">
            <Prose>
              {blocks.map((b, i) => (b.heading ? <h2 key={i} id={b.id}>{b.text}</h2> : <p key={i}>{b.text}</p>))}
            </Prose>
            <Callout tone="tip" title="Did this solve it?" className="mt-8">
              If it did not, raise a ticket and paste the link to this guide — knowing what you already tried
              saves the first round of questions.
            </Callout>
            <FeedbackWidget className="mt-8" />
          </div>
          {toc.length ? <aside className="hidden lg:block"><TableOfContents className="sticky top-24" items={toc} /></aside> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="container-page py-10">
      <PageHeader
        title="Knowledge base"
        description="Guides for the things we get asked most."
        actions={<Button as={Link} to="/tickets" variant="secondary">Raise a ticket</Button>}
      />

      {error ? <Alert tone="danger" className="mt-6">{error.message}</Alert> : null}

      <SearchFilterBar className="mt-6" query={query} onQueryChange={setQuery} placeholder="Search guides…" />
      {categories.length ? <TagCloud className="mt-6" tags={categories} active={category} /> : null}

      {!shown.length ? (
        <EmptyState
          icon={BookOpen}
          title={query || category ? 'Nothing matched' : 'No guides yet'}
          description={query || category ? 'Try a shorter search, or raise a ticket and we will write the guide you needed.' : 'Guides appear here as soon as they are published.'}
          actionLabel={query || category ? 'Clear filters' : undefined}
          onAction={() => { setQuery(''); setCategory('') }}
          className="mt-12"
        />
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((a) => (
            <Card key={a.id} as="button" className="text-left" onClick={() => setParams({ id: String(a.id) })}>
              <CardBody>
                {a.category ? <p className="text-xs font-medium uppercase tracking-wide text-brand-600">{a.category}</p> : null}
                <h3 className="mt-1 font-display text-base font-semibold text-ink-900">{a.title}</h3>
                {a.summary ? <p className="mt-2 text-sm leading-relaxed text-ink-600">{a.summary}</p> : null}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// Body format: blank-line-separated paragraphs; a line starting with "## " is a heading.
function parseBody(body) {
  const blocks = []
  const toc = []
  for (const chunk of String(body || '').split(/\n{2,}/)) {
    const text = chunk.trim()
    if (!text) continue
    if (text.startsWith('## ')) {
      const label = text.slice(3).trim()
      const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      blocks.push({ heading: true, text: label, id })
      toc.push({ id, label, level: 2 })
    } else {
      blocks.push({ heading: false, text })
    }
  }
  return { blocks, toc }
}
