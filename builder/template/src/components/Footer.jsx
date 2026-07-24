import { Link } from 'react-router-dom'
import { navLinks } from '../routes.js'

// TEMPLATE — site footer. Links come from the generated route manifest, so it stays in sync for free.
export default function Footer({ brand = 'Made with isibi', tagline, columns = [], social }) {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-16 border-t border-ink-100 bg-surface">
      <div className="container-page py-12">
        <div className="flex flex-wrap gap-10">
          <div className="min-w-56 flex-1">
            <p className="font-display text-lg font-bold text-ink-900">{brand}</p>
            {tagline && <p className="mt-2 max-w-xs text-sm text-ink-500">{tagline}</p>}
            {social && <div className="mt-4 flex gap-3">{social}</div>}
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">Pages</p>
            <ul className="space-y-2">
              {navLinks.map((l) => (
                <li key={l.to}><Link to={l.to} className="text-sm text-ink-600 transition hover:text-ink-900">{l.label}</Link></li>
              ))}
            </ul>
          </div>
          {columns.map((col, i) => (
            <div key={i}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">{col.title}</p>
              <ul className="space-y-2">
                {(col.links || []).map((l, j) => (
                  <li key={j}>
                    {l.to ? <Link to={l.to} className="text-sm text-ink-600 transition hover:text-ink-900">{l.label}</Link>
                          : <span className="text-sm text-ink-600">{l.label}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-10 border-t border-ink-100 pt-6 text-xs text-ink-400">© {year} {brand}. All rights reserved.</p>
      </div>
    </footer>
  )
}
