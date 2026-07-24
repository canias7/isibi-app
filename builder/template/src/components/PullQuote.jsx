import { cx } from '../lib/cx.js'

// PullQuote — the oversized quote that breaks up a long article. Distinct from a <blockquote> inside Prose:
// this one is a design element, set larger than the body and often pulled into the margin.
export default function PullQuote({ children, attribution, role, align = 'center', className }) {
  return (
    <figure className={cx('my-10', align === 'left' && 'lg:-ml-16', align === 'right' && 'lg:-mr-16 text-right', className)}>
      <div className={cx('border-brand-400 pl-6', align === 'right' ? 'border-r pr-6 pl-0' : 'border-l')}>
        <blockquote className="text-balance font-display text-2xl font-medium leading-snug tracking-tight text-ink-900 sm:text-3xl">
          {children}
        </blockquote>
        {attribution && (
          <figcaption className="mt-4 text-sm text-ink-500">
            <span className="font-medium text-ink-700">{attribution}</span>{role && <> · {role}</>}
          </figcaption>
        )}
      </div>
    </figure>
  )
}
