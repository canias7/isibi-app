import Avatar from './Avatar.tsx'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'
import type { Person } from '../lib/types.ts'

interface TeamGridProps {
  title?: string
  subtitle?: ReactNode
  members?: Person[]
  className?: string
}

// TeamGrid — the people section. members: [{name, role, avatar, bio}]
export default function TeamGrid({ title = 'Meet the team', subtitle, members = [], className }: TeamGridProps) {
  return (
    <section className={cx('py-16', className)}>
      <div className="container-page">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">{title}</h2>
          {subtitle && <p className="mt-3 text-ink-600">{subtitle}</p>}
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {members.map((m, i) => (
            <div key={i} className="text-center">
              <Avatar name={m.name} src={m.avatar} size="lg" className="mx-auto" />
              <h3 className="mt-4 font-display text-base font-semibold text-ink-900">{m.name}</h3>
              {m.role && <p className="text-sm text-brand-600">{m.role}</p>}
              {m.bio && <p className="mt-2 text-sm text-ink-500">{m.bio}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
