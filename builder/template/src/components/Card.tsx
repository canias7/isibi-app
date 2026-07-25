import { cx } from '../lib/cx.js'
import type React from 'react'
import type { ReactNode } from 'react'

type CardProps = React.ComponentPropsWithoutRef<'div'> & {
  className?: string
  children?: ReactNode
  as?: any
}

export function Card({ className, children, as: As = 'div', ...props }: CardProps) {
  return (
    <As className={cx('card-surface', className)} {...props}>
      {children}
    </As>
  )
}

type CardHeaderProps = React.ComponentPropsWithoutRef<'div'> & {
  className?: string
  children?: ReactNode
}

export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div className={cx('px-5 pt-5 pb-3 border-b border-ink-100', className)} {...props}>
      {children}
    </div>
  )
}

type CardBodyProps = React.ComponentPropsWithoutRef<'div'> & {
  className?: string
  children?: ReactNode
}

export function CardBody({ className, children, ...props }: CardBodyProps) {
  return (
    <div className={cx('px-5 py-4', className)} {...props}>
      {children}
    </div>
  )
}

type CardFooterProps = React.ComponentPropsWithoutRef<'div'> & {
  className?: string
  children?: ReactNode
}

export function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div className={cx('px-5 py-3 border-t border-ink-100 bg-ink-50/50 rounded-b-2xl', className)} {...props}>
      {children}
    </div>
  )
}

export default Card