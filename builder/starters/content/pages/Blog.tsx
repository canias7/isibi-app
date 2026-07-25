import { useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader.tsx'
import SearchFilterBar from '../components/SearchFilterBar.tsx'
import ArticleCard from '../components/ArticleCard.tsx'
import TagCloud from '../components/TagCloud.tsx'
import EmptyState from '../components/EmptyState.tsx'
import Skeleton from '../components/Skeleton.tsx'
import Alert from '../components/Alert.tsx'
import { useResource } from '../lib/useResource.ts'
import { FileSearch } from 'lucide-react'

export default function Blog() {
  const { data, loading, error } = useResource('posts')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')

  const live = useMemo(
    () => data.filter((p) => p.published !== false).sort((a, b) => (b.id || 0) - (a.id || 0)),
    [data]
  )

  // Counts come from the posts themselves, so a category chip can never point at an empty page.
  const tags = useMemo(() => {
    const counts = new Map()
    for (const p of live) if (p.category) counts.set(p.category, (counts.get(p.category) || 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count, onClick: () => setCategory(category === label ? '' : label) }))
  }, [live, category])

  const shown = live.filter((p) => {
    const q = query.trim().toLowerCase()
    return (!category || p.category === category) &&
      (!q || (p.title || '').toLowerCase().includes(q) || (p.excerpt || '').toLowerCase().includes(q))
  })

  return (
    <div className="container-page py-10">
      <PageHeader title="Archive" description="Everything published, newest first." />

      {error ? <Alert tone="danger" className="mt-6">{error.message}</Alert> : null}

      <SearchFilterBar className="mt-6" query={query} onQueryChange={setQuery} placeholder="Search posts…" />
      {tags.length ? <TagCloud className="mt-6" tags={tags} active={category} /> : null}

      {loading ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-80 w-full rounded-xl2" />)}
        </div>
      ) : !shown.length ? (
        <EmptyState
          icon={FileSearch}
          title={query || category ? 'Nothing matched' : 'Nothing published yet'}
          description={query || category ? 'Try a shorter search, or clear the topic filter.' : 'Posts appear here the moment they go live.'}
          actionLabel={query || category ? 'Clear filters' : undefined}
          onAction={() => { setQuery(''); setCategory('') }}
          className="mt-12"
        />
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <ArticleCard
              key={p.id}
              title={p.title}
              excerpt={p.excerpt}
              image={p.cover}
              to={`/article?slug=${encodeURIComponent(p.slug)}`}
              author={p.author}
              date={String(p.created_at || '').slice(0, 10)}
              readTime={p.read_minutes ? `${p.read_minutes} min read` : undefined}
              category={p.category}
            />
          ))}
        </div>
      )}
    </div>
  )
}
