import { Link } from 'react-router-dom'
import { Briefcase, Clock, MapPin } from 'lucide-react'
import { cx } from '../lib/cx.js'

// JobCard — a role in a listings feed. The salary is deliberately prominent: hiding it is the single most
// complained-about thing in job boards, so the component makes showing it the easy path.
export default function JobCard({
  title, company, logo, location, remote, type, salary, posted, tags = [], to, featured, applied, className,
}) {
  return (
    <Link to={to}
      className={cx('card-surface group block p-5 transition hover:border-ink-200 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        featured && 'border-brand-200 bg-brand-50/40', className)}>
      <div className="flex items-start gap-4">
        {logo
          ? <img src={logo} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
          : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-400"><Briefcase size={18} /></span>}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-semibold text-ink-900 group-hover:text-brand-700">{title}</h3>
            {featured && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">Featured</span>}
            {applied && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Applied</span>}
          </div>
          {company && <p className="mt-0.5 text-sm text-ink-600">{company}</p>}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-500">
            {(location || remote) && (
              <span className="inline-flex items-center gap-1"><MapPin size={12} />{remote ? (location ? `${location} · Remote` : 'Remote') : location}</span>
            )}
            {type && <span className="inline-flex items-center gap-1"><Briefcase size={12} />{type}</span>}
            {posted && <span className="inline-flex items-center gap-1"><Clock size={12} />{posted}</span>}
          </div>
          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((t) => <span key={t} className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-600">{t}</span>)}
            </div>
          )}
        </div>
        {salary && <p className="shrink-0 text-right font-display text-sm font-semibold text-ink-900">{salary}</p>}
      </div>
    </Link>
  )
}
