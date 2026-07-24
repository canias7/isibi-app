import { useState } from 'react'
import { Check, ShieldCheck } from 'lucide-react'
import OtpInput from './OtpInput.jsx'
import CopyButton from './CopyButton.jsx'
import Button from './Button.jsx'
import { cx } from '../lib/cx.js'

// TwoFactorSetup — the enrol-an-authenticator flow: scan or type the secret, confirm a code, save the
// recovery codes. The recovery step is NOT optional here — an account locked out of its own 2FA is the
// single most expensive support ticket a product can generate.
export default function TwoFactorSetup({
  secret, qr, onVerify, onDone, recoveryCodes = [], issuer = 'this app', account, busy = false, error, className,
}) {
  const [code, setCode] = useState('')
  const [stage, setStage] = useState('scan')
  const [saved, setSaved] = useState(false)
  const verify = async () => {
    if (code.length < 6) return
    const ok = onVerify ? await onVerify(code) : true
    if (ok) setStage(recoveryCodes.length ? 'recovery' : 'done')
  }
  return (
    <div className={cx('card-surface p-6', className)}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600"><ShieldCheck size={19} /></span>
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold text-ink-900">Two-factor authentication</h3>
          <p className="mt-0.5 text-sm text-ink-500">An extra code at sign-in, so a stolen password is not enough.</p>
        </div>
      </div>

      {stage === 'scan' && (
        <div className="mt-6 space-y-5">
          {/* Stacks by default and only goes side-by-side once there is genuinely room. In a narrow column the
              old flex-wrap row squeezed the secret until `truncate` ate it down to one character — and a key
              you cannot read is useless, since typing it by hand is the whole fallback path. */}
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
            <div className="grid h-40 w-40 shrink-0 place-items-center rounded-xl border border-ink-200 bg-surface p-2">
              {qr || <span className="text-center text-xs text-ink-400">Pass a <code className="font-mono">qr</code> node from your auth provider</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink-600">Scan this with your authenticator app, or enter the key by hand:</p>
              {secret && (
                <div className="mt-2">
                  {/* break-all, not truncate: the secret must always be fully readable, however narrow. */}
                  <code className="block break-all rounded-lg bg-ink-100 px-3 py-2 font-mono text-sm tracking-wider text-ink-800">{secret}</code>
                  <CopyButton value={secret} label="Copy key" className="mt-2" />
                </div>
              )}
              <p className="mt-3 text-xs text-ink-400">Account: {account || issuer}</p>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-ink-700">Enter the 6-digit code it shows</p>
            <OtpInput value={code} onChange={setCode} length={6} />
            {error && <p role="alert" className="mt-2 text-sm text-rose-600">{error}</p>}
          </div>
          <Button onClick={verify} disabled={code.length < 6 || busy}>{busy ? 'Checking…' : 'Verify and enable'}</Button>
        </div>
      )}

      {stage === 'recovery' && (
        <div className="mt-6">
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Save these recovery codes somewhere safe. Each works once, and they are the only way back in if you
            lose your device. You will not see them again.
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-ink-200 p-4">
            {recoveryCodes.map((c) => <li key={c} className="font-mono text-sm tracking-wider text-ink-800">{c}</li>)}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <CopyButton value={recoveryCodes.join('\n')} label="Copy all codes" />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="h-4 w-4 rounded accent-brand-600" />
              I have saved these codes
            </label>
          </div>
          <Button className="mt-4" disabled={!saved} onClick={() => { setStage('done'); onDone && onDone() }}>Finish</Button>
        </div>
      )}

      {stage === 'done' && (
        <p className="mt-6 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <Check size={16} />Two-factor authentication is on.
        </p>
      )}
    </div>
  )
}
