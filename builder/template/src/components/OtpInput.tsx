import { useRef } from 'react'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface OtpInputProps {
  value?: string
  onChange?: (...args: any[]) => any
  length?: number
  label?: ReactNode
  className?: string
}

// OtpInput — verification / sign-in codes. value is a string; length defaults to 6.
export default function OtpInput({ value = '', onChange, length = 6, label, className }: OtpInputProps) {
  const refs = useRef([])
  const chars = Array.from({ length }, (_, i) => value[i] || '')
  const set = (i, ch) => {
    const next = chars.slice(); next[i] = ch.slice(-1)
    onChange && onChange(next.join(''))
    if (ch && refs.current[i + 1]) refs.current[i + 1].focus()
  }
  return (
    <div className={className}>
      {label && <span className="mb-2 block text-sm font-medium text-ink-800">{label}</span>}
      <div className="flex gap-2">
        {chars.map((c, i) => (
          <input key={i} ref={(el) => (refs.current[i] = el)} value={c} inputMode="numeric" maxLength={1}
            aria-label={`Digit ${i + 1}`}
            onChange={(e) => set(i, (e.target as any).value)}
            onKeyDown={(e) => { if (e.key === 'Backspace' && !c && refs.current[i - 1]) refs.current[i - 1].focus() }}
            onPaste={(e) => { e.preventDefault(); onChange && onChange(e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)) }}
            className="h-12 w-11 rounded-xl border border-ink-200 text-center font-display text-lg font-semibold text-ink-900
              focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
        ))}
      </div>
    </div>
  )
}
