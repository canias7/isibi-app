import { Link } from 'react-router-dom'
import { Building2, Globe, MapPin, Users } from 'lucide-react'
import { cx } from '../lib/cx.js'
import type { Size } from '../lib/types.ts'

interface CompanyCardProps {
  name?: string
  logo?: string
  tagline?: any
  industry?: any
  size?: Size
  location?: any
  website?: any
  openRoles?: any
  to?: string
  tags?: any[]
  className?: string
}

// CompanyCard — an employer/vendor/partner profile tile: job boards, marketplaces, directories, portfolios.
export default function CompanyCard({
  name, logo, tagline, industry, size, location, website, openRoles, to, tags = [], className,
}: CompanyCardProps) {
  const facts = [
    industry && { icon: Building2, value: industry },
    size && { icon: Users, value: size },
    location && { icon: MapPin, value: location },
  ].filter(Boolean)
  const body = (
    <>
      <div className="flex items-start gap-4">
        {logo
          ? <img src={logo} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-ink-100" />
          : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-ink-100 font-display text-lg font-bold text-ink-400">{String(name || '?')[0]}</span>}
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-semibold text-ink-900">{name}</h3>
          {tagline && <p className="mt-0.5 line-clamp-2 text-sm text-ink-600">{tagline}</p>}
        </div>
        {openRoles != null && (
          <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
            {openRoles} open
          </span>
        )}
      </div>
      {facts.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-500">
          {facts.map((f, i) => { const Icon = f.icon; return <span key={i} className="inline-flex items-center gap-1"><Icon size={12} />{f.value}</span> })}
        </div>
      )}
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((t) => <span key={t} className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-600">{t}</span>)}
        </div>
      )}
      {website && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-400"><Globe size={12} />{website}</p>
      )}
    </>
  )
  const cls = cx('card-surface p-5', to && 'block transition hover:border-ink-200 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500', className)
  return to ? <Link to={to} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}
