import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface FormSectionProps {
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  className?: string
}

// FormSection — a titled group of fields on a longer form (settings, checkout, onboarding).
export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <section className={cx('grid gap-6 py-6 md:grid-cols-3', className)}>
      <div className="md:col-span-1">
        <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      </div>
      <div className="space-y-4 md:col-span-2">{children}</div>
    </section>
  )
}

interface FormActionsProps {
  children?: ReactNode
  className?: string
}

// FormActions — the sticky save/cancel row at the end of a form.
export function FormActions({ children, className }: FormActionsProps) {
  return <div className={cx('flex items-center justify-end gap-2 border-t border-ink-100 pt-5', className)}>{children}</div>
}

export default FormSection
