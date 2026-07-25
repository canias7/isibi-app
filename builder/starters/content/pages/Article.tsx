import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ArticleHeader from '../components/ArticleHeader.tsx'
import Prose from '../components/Prose.tsx'
import TableOfContents from '../components/TableOfContents.tsx'
import AuthorBio from '../components/AuthorBio.tsx'
import RelatedPosts from '../components/RelatedPosts.tsx'
import FeedbackWidget from '../components/FeedbackWidget.tsx'
import ShareButtons from '../components/ShareButtons.tsx'
import ReadingProgress from '../components/ReadingProgress.tsx'
import CommentList from '../components/Comment.tsx'
import Textarea from '../components/Textarea.tsx'
import Button from '../components/Button.tsx'
import Alert from '../components/Alert.tsx'
import EmptyState from '../components/EmptyState.tsx'
import Skeleton from '../components/Skeleton.tsx'
import { useResource } from '../lib/useResource.ts'
import { useAuth } from '../lib/auth.tsx'
import { FileQuestion } from 'lucide-react'

// The article is addressed by ?slug=, not /article/:slug — the router is generated from the page files that
// exist and has no dynamic segments, so a query parameter is the honest way to carry the id.
export default function Article() {
  const [params] = useSearchParams()
  const slug = params.get('slug') || ''
  const { user } = useAuth()
  const { data: posts, loading } = useResource('posts')
  const { data: allComments, saving, create } = useResource('comments', { params: { where: `post_slug:eq:${slug}` } })
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')

  const post = posts.find((p) => p.slug === slug) || null
  const related = posts.filter((p) => p.published !== false && p.slug !== slug).slice(0, 3)

  // Headings are pulled out of the body so the contents rail matches the article instead of being maintained
  // separately — a hand-kept ToC drifts the first time anyone edits a heading.
  const { blocks, toc } = useMemo(() => parseBody(post && post.body), [post])

  const postComment = async (e) => {
    e.preventDefault()
    setError('')
    const body = draft.trim()
    if (!body) return
    try {
      await create({ post_slug: slug, author: user?.display_name || user?.email || 'Anonymous', body })
      setDraft('')
    } catch (err) {
      setError(err.message || 'That comment could not be posted.')
    }
  }

  if (loading) {
    return <div className="container-page max-w-3xl space-y-4 py-16"><Skeleton className="h-10 w-3/4" /><Skeleton className="h-64 w-full rounded-xl2" /><Skeleton className="h-40 w-full" /></div>
  }

  if (!post) {
    return (
      <div className="container-page py-16">
        <EmptyState
          icon={FileQuestion}
          title="We could not find that post"
          description="It may have been unpublished, or the link may be wrong."
          actionLabel="Back to the archive"
          actionAs={Link}
          actionTo="/blog"
        />
      </div>
    )
  }

  return (
    <>
      <ReadingProgress targetId="article-body" />

      <article className="container-page py-10">
        <ArticleHeader
          category={post.category}
          categoryTo="/blog"
          title={post.title}
          standfirst={post.excerpt}
          author={post.author}
          date={String(post.created_at || '').slice(0, 10)}
          readTime={post.read_minutes ? `${post.read_minutes} min read` : undefined}
          cover={post.cover}
        />

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div id="article-body" className="min-w-0">
            <Prose>
              {blocks.map((b, i) => (b.heading
                ? <h2 key={i} id={b.id}>{b.text}</h2>
                : <p key={i}>{b.text}</p>))}
            </Prose>

            <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-ink-100 pt-6">
              <ShareButtons title={post.title} />
              <FeedbackWidget />
            </div>

            {post.author ? (
              <AuthorBio className="mt-10" name={post.author} to="/blog" bio="Writes here regularly." />
            ) : null}

            <section className="mt-12">
              <h2 className="font-display text-xl font-bold tracking-tight text-ink-900">
                Comments{allComments.length ? ` (${allComments.length})` : ''}
              </h2>

              {user ? (
                <form onSubmit={postComment} className="mt-4">
                  {error ? <Alert tone="danger" className="mb-3">{error}</Alert> : null}
                  <Textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add your thoughts…" aria-label="Your comment" />
                  <div className="mt-3 flex justify-end">
                    <Button type="submit" size="sm" loading={saving} disabled={saving || !draft.trim()}>Post comment</Button>
                  </div>
                </form>
              ) : (
                <Alert tone="info" className="mt-4" action={<Button as={Link} to="/signin" size="sm">Sign in</Button>}>
                  Sign in to join the conversation.
                </Alert>
              )}

              <CommentList
                className="mt-8"
                comments={allComments.map((c) => ({ id: c.id, author: c.author, body: c.body, time: String(c.created_at || '').slice(0, 10) }))}
              />
            </section>
          </div>

          {toc.length ? (
            <aside className="hidden lg:block">
              <TableOfContents className="sticky top-24" items={toc} />
            </aside>
          ) : null}
        </div>
      </article>

      {related.length ? (
        <RelatedPosts
          posts={related.map((p) => ({
            title: p.title,
            excerpt: p.excerpt,
            image: p.cover,
            to: `/article?slug=${encodeURIComponent(p.slug)}`,
            author: p.author,
            date: String(p.created_at || '').slice(0, 10),
            category: p.category,
          }))}
        />
      ) : null}
    </>
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
