import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface ModalProps {
  open?: boolean
  onClose?: (...args: any[]) => any
  title?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

// Modal — Radix Dialog underneath, our props on the outside.
//
// The hand-rolled version handled Escape, the backdrop click and body scroll-lock, which is the easy 80%. What
// it did NOT do is trap focus: Tab from the last field walked straight out of the dialog and into the page
// behind it, so for anyone on a keyboard or a screen reader the dialog was still "open" while their cursor was
// somewhere else entirely. Radix owns focus trapping, focus restore on close, aria-modal semantics and
// inert-ing the background. None of that is worth reimplementing.
//
// The prop signature is deliberately UNCHANGED, so every call site and every generated page keeps working.
export default function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  return (
    <Dialog.Root open={!!open} onOpenChange={(next) => { if (!next && onClose) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cx(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col',
            'rounded-2xl border border-ink-100 bg-surface shadow-xl focus:outline-none',
            SIZES[size] || SIZES.md
          )}
        >
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
            <Dialog.Title className="font-display text-lg font-semibold text-ink-900">{title}</Dialog.Title>
            <Dialog.Close
              aria-label="Close dialog"
              className="rounded-lg p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <X size={18} />
            </Dialog.Close>
          </div>
          {/* Radix logs a warning when a dialog has no description. The body IS the description here. */}
          <Dialog.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</Dialog.Description>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="rounded-b-2xl border-t border-ink-100 bg-ink-50/50 px-5 py-4">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
