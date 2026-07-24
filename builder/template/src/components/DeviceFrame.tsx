import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface DeviceFrameProps {
  variant?: string
  url?: string
  children?: ReactNode
  className?: string
}

// DeviceFrame — wraps a screenshot in a browser, phone or laptop chrome. A raw screenshot floating on a hero
// reads as unfinished; framed, it reads as a product shot. Pure CSS, no image assets.
export default function DeviceFrame({ variant = 'browser', url = 'app.example.com', children, className }: DeviceFrameProps) {
  if (variant === 'phone') {
    return (
      <div className={cx('relative mx-auto w-[280px] rounded-[2.5rem] border-[10px] border-ink-900 bg-ink-900 shadow-soft', className)}>
        <span className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-ink-900" aria-hidden="true" />
        <div className="overflow-hidden rounded-[1.8rem] bg-surface">
          <div className="aspect-[9/19] [&>*]:h-full [&>*]:w-full [&_img]:h-full [&_img]:w-full [&_img]:object-cover">{children}</div>
        </div>
      </div>
    )
  }
  if (variant === 'laptop') {
    return (
      <div className={cx('mx-auto w-full max-w-3xl', className)}>
        <div className="rounded-t-xl2 border-[8px] border-b-0 border-ink-900 bg-ink-900">
          <div className="overflow-hidden rounded-t-md bg-surface">
            <div className="aspect-[16/10] [&>*]:h-full [&>*]:w-full [&_img]:h-full [&_img]:w-full [&_img]:object-cover">{children}</div>
          </div>
        </div>
        {/* The base is wider than the lid — that overhang is what makes it read as a laptop rather than a box. */}
        <div className="mx-auto h-3 w-[108%] max-w-none -translate-x-[3.7%] rounded-b-xl bg-ink-800" />
      </div>
    )
  }
  return (
    <div className={cx('overflow-hidden rounded-xl2 border border-ink-200 bg-surface shadow-soft', className)}>
      <div className="flex items-center gap-2 border-b border-ink-100 bg-ink-50 px-3 py-2.5">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
        {url && (
          <span className="mx-auto max-w-[60%] truncate rounded-md bg-surface px-3 py-0.5 text-[11px] text-ink-400">{url}</span>
        )}
      </div>
      <div className="[&_img]:block [&_img]:w-full">{children}</div>
    </div>
  )
}
