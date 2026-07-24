import { cx } from '../lib/cx.js'

export default function Skeleton({ className }) {
  return <div className={cx('animate-pulse rounded-lg bg-ink-100', className)} />
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cx('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}

export function SkeletonRow({ cols = 4 }) {
  return (
    <div className="flex gap-4 px-4 py-3">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
  )
}