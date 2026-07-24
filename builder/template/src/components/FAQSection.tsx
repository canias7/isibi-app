import Accordion from './Accordion.tsx'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface FAQSectionProps {
  title?: string
  subtitle?: ReactNode
  items?: any[]
  className?: string
}

// FAQSection — questions block. items: [{title, content}] (same shape as Accordion).
export default function FAQSection({ title = 'Frequently asked questions', subtitle, items = [], className }: FAQSectionProps) {
  return (
    <section className={cx('py-16', className)}>
      <div className="container-page max-w-3xl">
        <div className="mb-8 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">{title}</h2>
          {subtitle && <p className="mt-3 text-ink-600">{subtitle}</p>}
        </div>
        <Accordion items={items} />
      </div>
    </section>
  )
}
