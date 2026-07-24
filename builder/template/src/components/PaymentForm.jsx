import { CreditCard, Lock } from 'lucide-react'
import Input from './Input.jsx'
import { cx } from '../lib/cx.js'

// PaymentForm — card details layout. NOTE: never post raw card numbers to your own backend; wire this to your
// payment provider's tokenizer. Shown here as the standard field arrangement.
export default function PaymentForm({ title = 'Payment', note = 'Payments are processed securely.', className }) {
  return (
    <div className={cx('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-400"><Lock size={12} />Secure</span>
      </div>
      <Input name="card_name" label="Name on card" autoComplete="cc-name" required />
      <Input name="card_number" label="Card number" inputMode="numeric" autoComplete="cc-number"
        placeholder="1234 5678 9012 3456" required />
      <div className="grid grid-cols-2 gap-4">
        <Input name="card_expiry" label="Expiry" placeholder="MM / YY" autoComplete="cc-exp" required />
        <Input name="card_cvc" label="CVC" placeholder="123" inputMode="numeric" autoComplete="cc-csc" required />
      </div>
      <p className="flex items-center gap-1.5 text-xs text-ink-400"><CreditCard size={13} />{note}</p>
    </div>
  )
}
