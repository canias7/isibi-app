import * as Pop from '@radix-ui/react-popover'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface PopoverProps {
  trigger?: ReactNode
  open?: boolean
  onOpenChange?: (...args: any[]) => any
  align?: string
  width?: string
  children?: ReactNode
  className?: string
}

// Popover — Radix Popover underneath, our props on the outside. A generic anchored overlay (filters, pickers,
// extra detail), controlled via `open`/`onOpenChange` or left to manage itself.
//
// The hand-rolled version had three problems Radix fixes for free: its trigger was a bare `<span onClick>`, so a
// keyboard user could never open it at all; it registered document listeners on EVERY render (no dependency
// array), reattaching them dozens of times on a busy page; and it was absolutely positioned against the trigger,
// so near a window edge it rendered half off-screen instead of flipping to the other side.
export default function Popover({ trigger, open: openProp, onOpenChange, align = 'left', width = 'w-72', children, className }: PopoverProps) {
  // Radix reads `open === undefined` as uncontrolled, which is exactly the old behaviour — so the controlled and
  // self-managed modes both keep working with no branch here.
  return (
    <Pop.Root open={openProp} onOpenChange={onOpenChange}>
      <Pop.Trigger asChild>
        <span tabIndex={0} className={cx('inline-flex cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500', className)}>
          {trigger}
        </span>
      </Pop.Trigger>
      <Pop.Portal>
        <Pop.Content
          align={align === 'right' ? 'end' : 'start'}
          sideOffset={8}
          collisionPadding={8}
          className={cx('z-30 rounded-xl border border-ink-100 bg-surface p-3 shadow-soft focus:outline-none', width)}
        >
          {children}
        </Pop.Content>
      </Pop.Portal>
    </Pop.Root>
  )
}
