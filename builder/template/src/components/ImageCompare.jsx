import { useRef, useState } from 'react'
import { cx } from '../lib/cx.js'

// ImageCompare — the before/after wipe slider. Portfolios, renovations, photo editing, retouching, restoration.
// Pointer-driven with a keyboard-accessible range input underneath, so it works without a mouse too.
export default function ImageCompare({ before, after, beforeAlt = 'Before', afterAlt = 'After', labels = true, aspect = '16/10', className }) {
  const box = useRef(null)
  const [pos, setPos] = useState(50)
  const dragging = useRef(false)
  const moveTo = (clientX) => {
    const r = box.current && box.current.getBoundingClientRect()
    if (!r) return
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)))
  }
  return (
    <div className={cx('relative select-none overflow-hidden rounded-xl2 bg-ink-100', className)} style={{ aspectRatio: aspect }}>
      <div ref={box} className="absolute inset-0"
        onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); moveTo(e.clientX) }}
        onPointerMove={(e) => dragging.current && moveTo(e.clientX)}
        onPointerUp={() => { dragging.current = false }}>
        <img src={after} alt={afterAlt} className="absolute inset-0 h-full w-full object-cover" draggable="false" />
        {/* The BEFORE image is clipped from the right, so dragging left reveals more of it. */}
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <img src={before} alt={beforeAlt} className="absolute inset-0 h-full w-full object-cover" draggable="false" />
        </div>
        {labels && (
          <>
            <span className="absolute left-3 top-3 rounded-full bg-ink-900/70 px-2.5 py-1 text-xs font-medium text-canvas">{beforeAlt}</span>
            <span className="absolute right-3 top-3 rounded-full bg-ink-900/70 px-2.5 py-1 text-xs font-medium text-canvas">{afterAlt}</span>
          </>
        )}
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-surface shadow" style={{ left: `${pos}%` }}>
          <span className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-surface text-ink-600 shadow-soft">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 6 3 12 9 18" /><polyline points="15 6 21 12 15 18" />
            </svg>
          </span>
        </div>
      </div>
      <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Reveal the before image" className="absolute inset-x-0 bottom-0 h-10 w-full cursor-ew-resize opacity-0 focus-visible:opacity-100" />
    </div>
  )
}
