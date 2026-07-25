import { forwardRef } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { Loader2 } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cx } from '../lib/cx.js'
import type React from 'react'
import type { ReactNode } from 'react'

// Variants live in `cva` rather than plain lookup objects (the shadcn pattern). The variant keys become part of
// the type, so a typo is a compile error instead of `variants[variant]` quietly evaluating to undefined and
// rendering an unstyled button. Exported so anything that needs to LOOK like a button without being one can
// reuse the exact classes instead of re-deriving them.
export const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed select-none',
  {
    variants: {
      variant: {
        primary: 'bg-brand-600 text-brandfg hover:bg-brand-700 active:bg-brand-800 shadow-sm',
        secondary: 'bg-surface text-ink-800 border border-ink-200 hover:bg-ink-50 active:bg-ink-100',
        outline: 'bg-surface text-ink-800 border border-ink-200 hover:bg-ink-50 active:bg-ink-100',
        ghost: 'bg-transparent text-ink-700 hover:bg-ink-100 active:bg-ink-200',
        danger: 'bg-rose-600 text-brandfg hover:bg-rose-700 active:bg-rose-800 shadow-sm',
        accent: 'bg-accent-500 text-brandfg hover:bg-accent-600 active:bg-accent-700 shadow-sm',
      },
      size: {
        sm: 'text-sm px-3 py-1.5 rounded-lg gap-1.5',
        md: 'text-sm px-4 py-2.5 rounded-xl gap-2',
        lg: 'text-base px-5 py-3 rounded-xl gap-2',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
)

type ButtonProps = React.ComponentPropsWithoutRef<'button'> & VariantProps<typeof buttonVariants> & {
  as?: any
  to?: string
  /**
   * Render the CHILD element with the button's classes instead of wrapping it in a <button>.
   * `<Button asChild><a href="…">Read more</a></Button>` yields a real anchor that looks like a button —
   * no prop forwarding and no button-inside-a-link nesting. Requires exactly one element child.
   */
  asChild?: boolean
  loading?: boolean
  disabled?: boolean
  className?: string
  children?: ReactNode
}

const Button = forwardRef(function Button(
  { as: As, asChild = false, variant, size, loading = false, disabled, className, children, ...props }: ButtonProps,
  ref: any
) {
  const Comp = asChild ? Slot : (As || 'button')
  return (
    <Comp
      ref={ref}
      disabled={disabled || loading}
      className={cx(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {/* Slot accepts exactly one child, so the spinner is only injected when we own the element. */}
      {asChild ? children : (
        <>
          {loading && <Loader2 size={16} className="animate-spin" />}
          {children}
        </>
      )}
    </Comp>
  )
})

export default Button
