import Hero from '../components/Hero.tsx'
import KnowledgeBaseSearch from '../components/KnowledgeBaseSearch.tsx'
import FeatureGrid from '../components/FeatureGrid.tsx'
import CTASection from '../components/CTASection.tsx'
import { useResource } from '../lib/useResource.ts'
import { useAuth } from '../lib/auth.tsx'
import { Clock, MessagesSquare, BookOpen, ShieldCheck } from 'lucide-react'

// The help centre. Self-service comes FIRST — the cheapest ticket is the one nobody has to raise — so the search
// box sits directly under the hero, with raising a ticket as the fallback beneath it.
export default function Home() {
  const { user } = useAuth()
  const { data: articles } = useResource('articles')
  const live = articles.filter((a) => a.published !== false)

  return (
    <>
      <Hero
        eyebrow="Help centre"
        title="How can we help?"
        subtitle="Search the guides below. If you cannot find it, raise a ticket and a person will pick it up."
        primaryCta={user ? { label: 'Open the queue', to: '/tickets' } : { label: 'Raise a ticket', to: '/tickets' }}
        secondaryCta={{ label: 'Browse all guides', to: '/knowledge-base' }}
        variant="center"
      />

      <section className="container-page pb-16">
        <KnowledgeBaseSearch
          articles={live.map((a) => ({ title: a.title, excerpt: a.summary, to: `/knowledge-base?id=${a.id}`, category: a.category }))}
          popular={live.slice(0, 5).map((a) => ({ label: a.title, to: `/knowledge-base?id=${a.id}` }))}
          placeholder="Search guides — billing, logins, exports…"
          emptyText="Nothing matched. Raise a ticket and we will write the guide you needed."
        />
      </section>

      <FeatureGrid
        eyebrow="What to expect"
        title="How support works here"
        features={[
          { icon: <Clock size={20} />, title: 'Four hours to first reply', body: 'Every ticket carries a countdown. Anything that breaches it goes to the top of the queue automatically.' },
          { icon: <MessagesSquare size={20} />, title: 'One thread, start to finish', body: 'Everything about your issue stays on the same ticket, so you never re-explain it to a second person.' },
          { icon: <BookOpen size={20} />, title: 'Answers before questions', body: 'Anything we get asked twice becomes a guide, so the next person finds it without waiting.' },
          { icon: <ShieldCheck size={20} />, title: 'Nothing gets dropped', body: 'A ticket can only move along a defined path, and closed means closed — resolved, then confirmed.' },
        ]}
      />

      <CTASection
        title="Still stuck?"
        subtitle="Tell us what happened and we will take it from there."
        primaryCta={{ label: 'Raise a ticket', to: '/tickets' }}
        tone="brand"
      />
    </>
  )
}
