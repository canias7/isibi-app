import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader.tsx'
import SearchFilterBar from '../components/SearchFilterBar.tsx'
import Button from '../components/Button.tsx'
import Badge from '../components/Badge.tsx'
import EmptyState from '../components/EmptyState.tsx'
import Skeleton from '../components/Skeleton.tsx'
import { Card, CardBody } from '../components/Card.tsx'
import { useResource } from '../lib/useResource.ts'
import { CalendarX, Clock } from 'lucide-react'

// The public service list. `services` is an `admin` table: everyone can read it, only the owner edits it,
// which is exactly what an online menu of services needs.
export default function Services() {
  const { data, loading, error } = useResource('services')
  const [query, setQuery] = useState('')
  const visible = data.filter((s) => s.active !== false && (s.name || '').toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="container-page py-10">
      <PageHeader
        title="Services"
        description="What we offer, how long it takes, and what it costs."
        actions={<Button as={Link} to="/book">Book a time</Button>}
      />

      <SearchFilterBar query={query} onQueryChange={setQuery} placeholder="Search services…" className="mt-6" />

      {error ? <p className="mt-6 text-sm text-rose-600">{error.message}</p> : null}

      {loading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl2" />)}
        </div>
      ) : !visible.length ? (
        <EmptyState
          icon={CalendarX}
          title={query ? 'Nothing matched that' : 'No services listed yet'}
          description={query ? 'Try a shorter search.' : 'Services appear here as soon as they are added.'}
          className="mt-10"
        />
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((s) => (
            <Card key={s.id}>
              <CardBody className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-base font-semibold text-ink-900">{s.name}</h3>
                  {s.price ? <Badge tone="brand">{formatPrice(s.price)}</Badge> : null}
                </div>
                {s.description ? <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">{s.description}</p> : <div className="flex-1" />}
                <div className="mt-4 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs text-ink-500">
                    <Clock size={14} />{s.duration_min || 30} min
                  </span>
                  <Button as={Link} to="/book" size="sm" variant="secondary">Book</Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function formatPrice(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return ''
  return '$' + n.toFixed(n % 1 === 0 ? 0 : 2)
}
