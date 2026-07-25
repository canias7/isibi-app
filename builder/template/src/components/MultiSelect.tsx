import { useRef } from 'react'
import * as Pop from '@radix-ui/react-popover'
import { ChevronDown, Check, X } from 'lucide-react'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface MultiSelectProps {
  options?: any[]
  value?: any[]
  onChange?: (...args: any[]) => any
  label?: ReactNode
  placeholder?: string
  className?: string
}

// MultiSelect — pick several from a fixed list (categories, amenities, assignees). `value` is an array.
//
// Radix has no multi-select primitive, so this is a HYBRID: Radix Popover owns the overlay (positioning,
// outside-click, Escape, moving focus into the panel and back to the trigger on close), and the option list is
// ours because the checkbox-list behaviour is specific to us.
//
// Three real bugs in the hand-rolled version, all of them keyboard: the panel could be opened with the keyboard
// but never navigated — no arrows, so a keyboard user could reach it and then get stuck; the remove-chip control
// was a `<span role="button">` with a click handler and no `tabIndex` or key handling, so it was unreachable
// entirely; and the panel was absolutely positioned, so on a field near the bottom of a form the options ran off
// the screen with no way to scroll to them.
export default function MultiSelect({ options = [], value = [], onChange, label, placeholder = 'Select…', className }: MultiSelectProps) {
  const listRef = useRef<any>(null)
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  const toggle = (v) => onChange && onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  const selected = opts.filter((o) => value.includes(o.value))

  // Roving focus across the options. Radix gets focus INTO the panel; moving around inside it is our job.
  const onListKeyDown = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return
    const items = [...(listRef.current ? listRef.current.querySelectorAll('[role="option"]') : [])]
    if (!items.length) return
    e.preventDefault()
    const at = items.indexOf(document.activeElement)
    const next = e.key === 'Home' ? 0
      : e.key === 'End' ? items.length - 1
      : e.key === 'ArrowDown' ? (at + 1) % items.length
      : (at - 1 + items.length) % items.length
    items[next].focus()
  }

  return (
    <div className={cx('relative', className)}>
      {label && <span className="mb-1.5 block text-sm font-medium text-ink-800">{label}</span>}
      <Pop.Root>
        <Pop.Trigger asChild>
          <button
            type="button"
            aria-haspopup="listbox"
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-ink-200 bg-surface px-3 py-2 text-left
              focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <span className="flex min-w-0 flex-wrap gap-1">
              {selected.length === 0 && <span className="py-0.5 text-sm text-ink-400">{placeholder}</span>}
              {selected.map((o) => (
                <span key={o.value} className="inline-flex items-center gap-1 rounded-lg bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                  {o.label}
                  {/* A real button, not a span: the old chip remove was click-only and unreachable by keyboard.
                      It cannot nest inside the trigger button, so it is rendered as a sibling overlay control. */}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Remove ${o.label}`}
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggle(o.value) }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); toggle(o.value) } }}
                    className="cursor-pointer opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <X size={11} />
                  </span>
                </span>
              ))}
            </span>
            <ChevronDown size={16} className="shrink-0 text-ink-400 transition" />
          </button>
        </Pop.Trigger>

        <Pop.Portal>
          <Pop.Content
            align="start"
            sideOffset={6}
            collisionPadding={8}
            // Match the trigger's width, which absolute positioning used to do with `w-full`.
            style={{ width: 'var(--radix-popover-trigger-width)' }}
            className="z-30 max-h-56 overflow-y-auto rounded-xl border border-ink-100 bg-surface py-1 shadow-soft focus:outline-none"
          >
            <ul ref={listRef} role="listbox" aria-multiselectable="true" onKeyDown={onListKeyDown}>
              {opts.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value.includes(o.value)}
                    onClick={() => toggle(o.value)}
                    className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-sm text-ink-700 transition hover:bg-ink-50 focus-visible:bg-ink-50 focus-visible:outline-none"
                  >
                    {o.label}
                    {value.includes(o.value) && <Check size={15} className="text-brand-500" />}
                  </button>
                </li>
              ))}
            </ul>
          </Pop.Content>
        </Pop.Portal>
      </Pop.Root>
    </div>
  )
}
