import { isValidElement } from 'react'
import * as Tip from '@radix-ui/react-tooltip'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface TooltipProps {
  label?: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  children?: ReactNode
  className?: string
}

// Tooltip — Radix Tooltip underneath, our props on the outside.
//
// The hand-rolled version showed on hover and focus, which sounds like enough until you notice it was never
// announced to a screen reader (the tip was a sibling span with no `aria-describedby` linking it to the
// trigger), it never dismissed on Escape, and it was absolutely positioned so a tooltip on a button at the
// edge of the window rendered half off-screen. Radix handles the description wiring, Escape, the hover grace
// period, and flipping to the opposite side when there is no room.
//
// The Provider is INSIDE the component on purpose. Radix wants one at the app root, which is marginally more
// efficient (a shared "skip the delay" window between neighbouring tooltips), but a generated page can render a
// Tooltip anywhere and a missing provider is a hard crash. Self-contained beats globally-optimal here.
export default function Tooltip({ label, side = 'top', children, className }: TooltipProps) {
  if (!label) return <span className={cx('inline-flex', className)}>{children}</span>
  return (
    <Tip.Provider delayDuration={300}>
      <Tip.Root>
        {/* asChild must land on the FOCUSABLE element, not a wrapper. Radix puts `aria-describedby` on whatever
            the trigger renders; if that is a plain <span> around a button, the attribute sits on something the
            user can never focus and a screen reader never announces the tip. So when `children` is a single
            element (the normal case — a Button, an icon button) it becomes the trigger itself. Only bare text or
            a fragment falls back to a wrapper, and that wrapper is made focusable so the tip is still reachable. */}
        {isValidElement(children) ? (
          <Tip.Trigger asChild>{children}</Tip.Trigger>
        ) : (
          <Tip.Trigger asChild>
            <span tabIndex={0} className={cx('inline-flex rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500', className)}>{children}</span>
          </Tip.Trigger>
        )}
        <Tip.Portal>
          <Tip.Content
            side={side}
            sideOffset={6}
            collisionPadding={8}
            className="z-40 max-w-xs rounded-lg bg-ink-900 px-2.5 py-1.5 text-xs font-medium text-canvas shadow"
          >
            {label}
            <Tip.Arrow className="fill-ink-900" />
          </Tip.Content>
        </Tip.Portal>
      </Tip.Root>
    </Tip.Provider>
  )
}
