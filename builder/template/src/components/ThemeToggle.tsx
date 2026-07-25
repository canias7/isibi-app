import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cx } from '../lib/cx.js'

const KEY = 'isibi_theme'
const MODES = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
]

// applyTheme(mode) — writes `class="dark"` and `data-theme` on <html>. Exported so an inline script in
// index.html can run it BEFORE first paint and avoid the white flash on a dark-mode reload.
export function applyTheme(mode) {
  try {
    const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  } catch { /* SSR or a locked-down document — nothing to do */ }
}

interface ThemeToggleProps {
  variant?: string
  className?: string
}

// ThemeToggle — light / dark / follow-system. Note the app's palette is generated per app, so this only has
// an effect when that app's tailwind config defines dark variants; on a single-theme app leave it out.
export default function ThemeToggle({ variant = 'segmented', className }: ThemeToggleProps) {
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem(KEY) || 'system' } catch { return 'system' }
  })
  useEffect(() => {
    applyTheme(mode)
    try { localStorage.setItem(KEY, mode) } catch {}
    if (mode !== 'system') return
    // Follow the OS while on "system" — otherwise the page keeps yesterday's theme after sunset.
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mode])

  if (variant === 'button') {
    const dark = document.documentElement.classList.contains('dark')
    return (
      <button type="button" onClick={() => setMode(dark ? 'light' : 'dark')} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
        className={cx('rounded-lg p-2 text-ink-500 transition hover:bg-ink-100 hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500', className)}>
        {dark ? <Sun size={17} /> : <Moon size={17} />}
      </button>
    )
  }
  return (
    <div role="radiogroup" aria-label="Theme" className={cx('inline-flex rounded-lg border border-ink-200 bg-surface p-0.5', className)}>
      {MODES.map((m) => {
        const Icon = m.icon
        const on = mode === m.id
        return (
          <button key={m.id} type="button" role="radio" aria-checked={on} onClick={() => setMode(m.id)} aria-label={m.label}
            className={cx('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              on ? 'bg-ink-100 text-ink-900' : 'text-ink-500 hover:text-ink-800')}>
            <Icon size={14} />
            <span className="hidden sm:inline">{m.label}</span>
          </button>
        )
      })}
    </div>
  )
}
