import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface AspectRatioProps {
  ratio?: string
  children?: ReactNode
  className?: string
}

// AspectRatio — keeps media boxes from jumping while they load. ratio: '16/9' | '4/3' | '1/1' | '3/4'
export default function AspectRatio({ ratio = '16/9', children, className }: AspectRatioProps) {
  const map = { '16/9': 'aspect-[16/9]', '4/3': 'aspect-[4/3]', '1/1': 'aspect-square', '3/4': 'aspect-[3/4]', '21/9': 'aspect-[21/9]' }
  return (
    <div className={cx('relative overflow-hidden bg-ink-100', map[ratio] || 'aspect-[16/9]', className)}>
      <div className="absolute inset-0 [&>img]:h-full [&>img]:w-full [&>img]:object-cover">{children}</div>
    </div>
  )
}
