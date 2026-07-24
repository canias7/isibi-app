import { Inbox } from 'lucide-react'
import Button from './Button.jsx'

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  description,
  actionLabel,
  onAction,
  actionAs,
  actionTo,
  className,
}) {
  return (
    <div className={'flex flex-col items-center justify-center text-center py-14 px-6 ' + (className || '')}>
      <div className="h-14 w-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
        <Icon size={26} strokeWidth={1.75} />
      </div>
      <h3 className="font-display font-semibold text-ink-900 text-lg">{title}</h3>
      {description && <p className="text-sm text-ink-500 mt-1.5 max-w-sm">{description}</p>}
      {actionLabel && (
        <Button
          className="mt-5"
          onClick={onAction}
          as={actionAs}
          to={actionTo}
          variant="primary"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  )
}