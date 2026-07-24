import { Link } from 'react-router-dom'
import { ArrowLeft, Home, RotateCcw } from 'lucide-react'
import Button from './Button.jsx'
import { cx } from '../lib/cx.js'

// Copy that says what happened and what to do next. "Something went wrong" alone tells a user nothing.
const PRESETS = {
  404: { title: 'We cannot find that page', body: 'The link may be out of date, or the page may have moved.' },
  403: { title: 'You do not have access to this', body: 'Ask an admin to grant you access, or sign in with a different account.' },
  500: { title: 'Something broke on our side', body: 'This is not your fault. We have been told about it — try again in a moment.' },
  offline: { title: 'You appear to be offline', body: 'Check your connection and try again. Nothing you had entered has been lost.' },
}

// ErrorPage — the full-page error body: 404, 403, 500, offline. ErrorBoundary catches the crash; this is
// what you render inside it.
export default function ErrorPage({
  code = 404, title, body, homeTo = '/', onRetry, onBack, actions, illustration, className,
}) {
  const preset = PRESETS[code] || PRESETS[500]
  return (
    <div className={cx('flex min-h-[60vh] items-center justify-center px-6 py-20', className)}>
      <div className="w-full max-w-md text-center">
        {illustration || (
          <p className="font-display text-7xl font-bold tracking-tight text-ink-200" aria-hidden="true">{code}</p>
        )}
        <h1 className="mt-4 text-balance font-display text-2xl font-bold tracking-tight text-ink-900">{title || preset.title}</h1>
        <p className="mt-3 text-ink-600">{body || preset.body}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {onRetry && <Button onClick={onRetry}><RotateCcw size={15} />Try again</Button>}
          {onBack && <Button variant="outline" onClick={onBack}><ArrowLeft size={15} />Go back</Button>}
          {homeTo && <Button as={Link} to={homeTo} variant={onRetry || onBack ? 'ghost' : 'primary'}><Home size={15} />Back to home</Button>}
          {actions}
        </div>
      </div>
    </div>
  )
}
