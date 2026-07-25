import { useRef, useState } from 'react'
import { Eraser } from 'lucide-react'
import { cx } from '../lib/cx.js'

interface SignaturePadProps {
  onChange?: (...args: any[]) => any
  label?: string
  hint?: string
  height?: number
  className?: string
}

// SignaturePad — draw-to-sign for contracts, waivers, delivery proof, consent forms. Pointer events cover
// mouse, touch and stylus in one code path. onChange(dataUrl|null) fires on stroke end, so a form can submit
// the PNG straight to the backend.
export default function SignaturePad({ onChange, label = 'Signature', hint = 'Sign with your mouse, finger or stylus.', height = 160, className }: SignaturePadProps) {
  const canvas = useRef<any>(null)
  const drawing = useRef(false)
  const [empty, setEmpty] = useState(true)

  const ctxOf = () => {
    const c = canvas.current
    if (!c) return null
    // Size the backing store to the CSS box once, at first draw — sizing it in a layout effect would run before
    // the element has its final width inside a flex/grid parent, and the stroke would land in the wrong place.
    if (c.width !== c.offsetWidth || c.height !== c.offsetHeight) { c.width = c.offsetWidth; c.height = c.offsetHeight }
    const ctx = c.getContext('2d')
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111827'
    return ctx
  }
  const pos = (e) => {
    const r = canvas.current.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }
  const down = (e) => {
    const ctx = ctxOf(); if (!ctx) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    ctx.beginPath(); ctx.moveTo(...pos(e))
  }
  const move = (e) => {
    if (!drawing.current) return
    const ctx = ctxOf(); if (!ctx) return
    ctx.lineTo(...pos(e)); ctx.stroke()
    if (empty) setEmpty(false)
  }
  const up = () => {
    if (!drawing.current) return
    drawing.current = false
    try { onChange && onChange(canvas.current.toDataURL('image/png')) } catch {}
  }
  const clear = () => {
    const c = canvas.current; if (!c) return
    c.getContext('2d').clearRect(0, 0, c.width, c.height)
    setEmpty(true); onChange && onChange(null)
  }

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between">
        {label && <span className="text-sm font-medium text-ink-700">{label}</span>}
        <button type="button" onClick={clear} disabled={empty}
          className={cx('inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            empty ? 'cursor-not-allowed text-ink-300' : 'text-ink-500 hover:bg-ink-100 hover:text-ink-700')}>
          <Eraser size={13} />Clear
        </button>
      </div>
      <div className="relative overflow-hidden rounded-xl2 border border-ink-200 bg-surface">
        <canvas ref={canvas} style={{ height }} className="block w-full touch-none"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
        {empty && (
          <span className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-sm text-ink-300">{hint}</span>
        )}
        <span className="pointer-events-none absolute inset-x-8 bottom-5 border-b border-dashed border-ink-200" aria-hidden="true" />
      </div>
    </div>
  )
}
