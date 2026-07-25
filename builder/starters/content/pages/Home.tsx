import { Link } from 'react-router-dom'
import Hero from '../components/Hero.tsx'
import ArticleCard from '../components/ArticleCard.tsx'
import NewsletterSignup from '../components/NewsletterSignup.tsx'
import Button from '../components/Button.tsx'
import Skeleton from '../components/Skeleton.tsx'
import { useResource } from '../lib/useResource.ts'

// Landing page. The lead story and the grid below it are REAL posts, so the front page can never disagree with
// what is actually published.
export default function Home() {
  const { data, loading } = useResource('posts')
  const live = data.filter((p) => p.published !== false).sort((a, b) => (b.id || 0) - (a.id || 0))
  const [lead, ...rest] = live

  return (
    <>
      <Hero
        eyebrow="The journal"
        title="Long reads on the things we keep thinking about"
        subtitle="Essays, notes and interviews, published when they are actually finished rather than on a schedule."
        primaryCta={{ label: 'Read the latest', to: '/blog' }}
        variant="center"
      />

      <section className="container-page pb-16">
        {loading ? (
          <div className="grid gap-6 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-80 w-full rounded-xl2" />)}
          </div>
        ) : !live.length ? (
          <p className="rounded-xl2 border border-dashed border-ink-200 p-12 text-center text-sm text-ink-500">
            Nothing published yet. Posts appear here the moment they go live.
          </p>
        ) : (
          <>
            {lead ? (
              <ArticleCard
                className="mb-10"
                title={lead.title}
                excerpt={lead.excerpt}
                image={lead.cover}
                to={`/article?slug=${encodeURIComponent(lead.slug)}`}
                author={lead.author}
                date={String(lead.created_at || '').slice(0, 10)}
                readTime={lead.read_minutes ? `${lead.read_minutes} min read` : undefined}
                category={lead.category}
              />
            ) : null}
            {rest.length ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {rest.slice(0, 6).map((p) => (
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
            ) : null}
            {live.length > 7 ? (
              <div className="mt-10 text-center">
                <Button as={Link} to="/blog" variant="secondary">Browse the archive</Button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <NewsletterSignup
        title="New pieces, straight to you"
        subtitle="One email when something is published. Nothing else, ever."
        note="Unsubscribe in a click."
      />
    </>
  )
}
