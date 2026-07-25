import { AlertTriangle } from 'lucide-react'
import Modal from './Modal.tsx'
import Button from './Button.tsx'

interface ConfirmDialogProps {
  open?: boolean
  onClose?: (...args: any[]) => any
  onConfirm?: (...args: any[]) => any
  title?: string
  message?: any
  confirmLabel?: string
  cancelLabel?: string
  tone?: string
  busy?: boolean
}

// ConfirmDialog — the "are you sure?" gate before a destructive action.
export default function ConfirmDialog({ open, onClose, onConfirm, title = 'Are you sure?', message, confirmLabel = 'Delete', cancelLabel = 'Cancel', tone = 'danger', busy = false }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex gap-3">
        <span className={tone === 'danger' ? 'text-rose-500' : 'text-accent-500'}><AlertTriangle size={20} /></span>
        <p className="text-sm leading-relaxed text-ink-600">{message}</p>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={busy}>{cancelLabel}</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
