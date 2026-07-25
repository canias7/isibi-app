import { Link } from 'react-router-dom'
import Hero from '../components/Hero.tsx'
import ProductCard from '../components/ProductCard.tsx'
import SplitFeature from '../components/SplitFeature.tsx'
import StatsBand from '../components/StatsBand.tsx'
import TestimonialGrid from '../components/TestimonialGrid.tsx'
import CTASection from '../components/CTASection.tsx'
import Button from '../components/Button.tsx'
import Skeleton from '../components/Skeleton.tsx'
import { useResource } from '../lib/useResource.ts'
import { useCart, money } from '../lib/cart.ts'

// Landing page. The featured strip is REAL data — the first few live products — so the home page is never a
// mock-up that disagrees with the shop.
export default function Home() {
  const { data, loading } = useResource('products', { params: { limit: 4 } })
  const { add } = useCart()
  const featured = data.filter((p) => p.active !== false).slice(0, 4)

  return (
    <>
      <Hero
        eyebrow="New season"
        title="Things worth keeping"
        subtitle="A small, considered range. Made properly, priced honestly, shipped quickly."
        primaryCta={{ label: 'Shop everything', to: '/shop' }}
        secondaryCta={{ label: 'Track an order', to: '/orders' }}
        notes={['Free delivery over $50', '30-day returns']}
        media={<img src="@@IMG:a clean flat-lay of well-made everyday objects on a warm neutral surface, soft daylight@@" alt="" className="w-full rounded-xl2 object-cover" />}
      />

      <section className="container-page py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">Just in</h2>
            <p className="mt-2 text-ink-600">The newest additions to the range.</p>
          </div>
          <Button as={Link} to="/shop" variant="secondary">See all</Button>
        </div>
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-72 w-full rounded-xl2" />)}
          </div>
        ) : featured.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((p) => (
              <ProductCard
                key={p.id}
                title={p.title}
                price={money(p.price)}
                comparePrice={p.compare_price ? money(p.compare_price) : undefined}
                image={p.image}
                to="/shop"
                onAdd={() => add(p)}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl2 border border-dashed border-ink-200 p-10 text-center text-sm text-ink-500">
            Products appear here as soon as they are added in the admin console.
          </p>
        )}
      </section>

      <SplitFeature
        eyebrow="Why us"
        title="Fewer things, chosen carefully"
        body="We would rather stock twenty things we can stand behind than two thousand we cannot. Everything here is something we use ourselves."
        bullets={['Made to last, not to replace', 'Honest pricing with no fake discounts', 'Real people answer the emails']}
        media={<img src="@@IMG:a workshop bench with tools and materials, warm light, shallow depth of field@@" alt="" className="w-full rounded-xl2 object-cover" />}
      />

      <StatsBand stats={[{ value: '12k+', label: 'Orders shipped' }, { value: '4.9', label: 'Average rating' }, { value: '48h', label: 'Typical dispatch' }, { value: '30d', label: 'Returns window' }]} />

      <TestimonialGrid
        title="From people who bought"
        items={[
          { quote: 'Arrived in two days, packed properly, and it is exactly what the photos showed.', author: 'Nadia Okafor', role: 'Verified buyer', rating: 5 },
          { quote: 'I emailed about a size and got a real answer from a real person within the hour.', author: 'Sam Delgado', role: 'Verified buyer', rating: 5 },
          { quote: 'Second order this year. That is about as strong a recommendation as I can give.', author: 'Harriet Lowe', role: 'Verified buyer', rating: 5 },
        ]}
      />

      <CTASection
        title="Have a look around"
        subtitle="Free delivery on orders over $50."
        primaryCta={{ label: 'Shop everything', to: '/shop' }}
        tone="brand"
      />
    </>
  )
}
