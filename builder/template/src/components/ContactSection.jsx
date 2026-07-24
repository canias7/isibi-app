import Input from './Input.jsx'
import Textarea from './Textarea.jsx'
import Button from './Button.jsx'
import { cx } from '../lib/cx.js'

// ContactSection — contact copy + a form. Pass onSubmit(e); wire it to the backend.
export default function ContactSection({ title = 'Get in touch', subtitle, details = [], onSubmit, busy = false, submitLabel = 'Send message', className }) {
  return (
    <section className={cx('py-16', className)}>
      <div className="container-page grid gap-12 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">{title}</h2>
          {subtitle && <p className="mt-3 text-ink-600">{subtitle}</p>}
          {details.length > 0 && (
            <dl className="mt-8 space-y-4">
              {details.map((d, i) => (
                <div key={i} className="flex items-start gap-3">
                  {d.icon && <span className="mt-0.5 text-brand-500">{d.icon}</span>}
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-ink-400">{d.label}</dt>
                    <dd className="text-sm text-ink-800">{d.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          )}
        </div>
        <form onSubmit={onSubmit} className="card-surface space-y-4 p-6">
          <Input name="name" label="Name" placeholder="Jane Doe" required />
          <Input name="email" type="email" label="Email" placeholder="jane@company.com" required />
          <Textarea name="message" label="Message" rows={5} placeholder="How can we help?" required />
          <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Sending…' : submitLabel}</Button>
        </form>
      </div>
    </section>
  )
}
