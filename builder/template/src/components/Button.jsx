import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cx } from '../lib/cx.js'

const variants = {
  primary: 'bg-brand-600 text-brandfg hover:bg-brand-700 active:bg-brand-800 shadow-sm',
  secondary: 'bg-surface text-ink-800 border border-ink-200 hover:bg-ink-50 active:bg-ink-100',
  ghost: 'bg-transparent text-ink-700 hover:bg-ink-100 active:bg-ink-200',
  danger: 'bg-rose-600 text-brandfg hover:bg-rose-700 active:bg-rose-800 shadow-sm',
  accent: 'bg-accent-500 text-brandfg hover:bg-accent-600 active:bg-accent-700 shadow-sm',
}

const sizes = {
  sm: 'text-sm px-3 py-1.5 rounded-lg gap-1.5',
  md: 'text-sm px-4 py-2.5 rounded-xl gap-2',
  lg: 'text-base px-5 py-3 rounded-xl gap-2',
}

const Button = forwardRef(function Button(
  { as: As = 'button', variant = 'primary', size = 'md', loading = false, disabled, className, children, ...props },
  ref
) {
  return (
    <As
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed select-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </As>
  )
})

export default Button