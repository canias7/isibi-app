import { cx } from '../lib/cx.js'

export function Card({ className, children, as: As = 'div', ...props }) {
  return (
    <As className={cx('card-surface', className)} {...props}>
      {children}
    </As>
  )
}

export function CardHeader({ className, children, ...props }) {
  return (
    <div className={cx('px-5 pt-5 pb-3 border-b border-ink-100', className)} {...props}>
      {children}
    </div>
  )
}

export function CardBody({ className, children, ...props }) {
  return (
    <div className={cx('px-5 py-4', className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ className, children, ...props }) {
  return (
    <div className={cx('px-5 py-3 border-t border-ink-100 bg-ink-50/50 rounded-b-2xl', className)} {...props}>
      {children}
    </div>
  )
}

export default Card