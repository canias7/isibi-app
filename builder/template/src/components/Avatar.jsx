import { cx } from '../lib/cx.js'

const colors = [
  'bg-brand-100 text-brand-700',
  'bg-accent-100 text-accent-700',
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
]

function hashColor(str) {
  let hash = 0
  for (let i = 0; i < (str || '').length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function Avatar({ name = '', src, size = 'md', className }) {
  const sizes = {
    sm: 'h-7 w-7 text-xs',
    md: 'h-9 w-9 text-sm',
    lg: 'h-12 w-12 text-base',
  }
  if (src) {
    return (
      <img
        src={src}
        alt={name ? `${name}'s avatar` : 'User avatar'}
        className={cx('rounded-full object-cover shrink-0', sizes[size], className)}
      />
    )
  }
  return (
    <div
      className={cx(
        'rounded-full flex items-center justify-center font-semibold shrink-0',
        hashColor(name),
        sizes[size],
        className
      )}
      aria-label={name || 'User avatar'}
    >
      {initials(name)}
    </div>
  )
}