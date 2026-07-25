import * as Menu from '@radix-ui/react-dropdown-menu'
import { MoreHorizontal } from 'lucide-react'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface DropdownProps {
  trigger?: ReactNode
  items?: any[]
  align?: string
  label?: string
  className?: string
}

// Dropdown — Radix DropdownMenu underneath, our props on the outside.
// `items` are {label, onSelect, icon, danger} or {separator: true}.
//
// The hand-rolled version closed on outside-click and Escape, and that was the whole of it. But a menu is a
// keyboard widget: arrows move between items, Home/End jump to the ends, typing a letter jumps to the matching
// item, and focus returns to the trigger on close. None of that existed. It also had no idea it was near the
// bottom of the window — it rendered downwards and off the screen. Radix does all of it.
export default function Dropdown({ trigger, items = [], align = 'right', label = 'More options', className }: DropdownProps) {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        {trigger
          // A caller's trigger is usually already a button, so a <button> wrapper would nest buttons (invalid
          // HTML). The span keeps the markup valid; Radix puts the menu ARIA and key handling on it.
          ? (
            <span
              tabIndex={0}
              className={cx('inline-flex cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500', className)}
            >
              {trigger}
            </span>
          )
          // With NO trigger, fall back to a real ⋯ button so `<Dropdown items={…} />` works on its own.
          : (
            <button
              type="button"
              aria-label={String(label ?? '')}
              className={cx('rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500', className)}
            >
              <MoreHorizontal size={16} />
            </button>
          )}
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Content
          align={align === 'right' ? 'end' : 'start'}
          sideOffset={8}
          // collisionPadding is a large part of why this moved to Radix: near the bottom of the window the menu
          // now flips above the trigger instead of rendering off-screen.
          collisionPadding={8}
          className="z-30 min-w-48 overflow-hidden rounded-xl border border-ink-100 bg-surface py-1 shadow-soft"
        >
          {items.map((it, i) =>
            it.separator ? (
              <Menu.Separator key={i} className="my-1 h-px bg-ink-100" />
            ) : (
              <Menu.Item
                key={i}
                onSelect={() => { if (it.onSelect) it.onSelect() }}
                className={cx(
                  'flex cursor-pointer select-none items-center gap-2.5 px-3.5 py-2 text-sm outline-none transition',
                  it.danger
                    ? 'text-rose-600 data-[highlighted]:bg-rose-50'
                    : 'text-ink-700 data-[highlighted]:bg-ink-50'
                )}
              >
                {it.icon}
                {it.label}
              </Menu.Item>
            )
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
