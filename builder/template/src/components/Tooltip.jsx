import { useState } from 'react'
import { cx } from '../lib/cx.js'

export default function Tooltip({ label, side = 'top', children, className }) {
  const [show, setShow] = useState(false)
  const pos = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }
  return (
    <span className={cx('relative inline-flex', className)}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)} onBlur={() => setShow(false)}>
      {children}
      {show && (
        <span role="tooltip"
          className={cx('pointer-events-none absolute z-40 whitespace-nowrap rounded-lg bg-ink-900 px-2.5 py-1.5 text-xs font-medium text-canvas shadow', pos[side])}>
          {label}
        </span>
      )}
    </span>
  )
}
