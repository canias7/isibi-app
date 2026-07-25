import ArticleCard from './ArticleCard.tsx'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface RelatedPostsProps {
  title?: string
  subtitle?: ReactNode
  posts?: any[]
  columns?: number
  className?: string
}

// RelatedPosts — the "read next" strip under an article. Takes the same item shape as ArticleCard so a page
// can pass the raw list straight through.
export default function RelatedPosts({ title = 'Read next', subtitle, posts = [], columns = 3, className }: RelatedPostsProps) {
  if (!posts.length) return null
  const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }
  return (
    <section className={cx('border-t border-ink-100 py-14', className)}>
      <div className="container-page">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink-900">{title}</h2>
          {subtitle && <p className="text-sm text-ink-500">{subtitle}</p>}
        </div>
        <div className={cx('mt-8 grid gap-6', cols[columns] || cols[3])}>
          {posts.map((p, i) => <ArticleCard key={p.id || i} {...p} />)}
        </div>
      </div>
    </section>
  )
}
