import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { cx } from '../lib/cx.js'

interface OfflineBannerProps {
  message?: string
  backMessage?: string
  className?: string
}

// OfflineBanner — tells the user the network dropped, so a failed save reads as "you're offline" instead of
// "this app is broken". Listens to the browser's own online/offline events; mount it once in a layout.
export default function OfflineBanner({
  message = 'You are offline. Changes will not save until the connection is back.',
  backMessage = 'Back online.', className,
}: OfflineBannerProps) {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [justBack, setJustBack] = useState(false)
  useEffect(() => {
    const up = () => { setOnline(true); setJustBack(true); setTimeout(() => setJustBack(false), 3000) }
    const down = () => setOnline(false)
    window.addEventListener('online', up); window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  if (online && !justBack) return null
  return (
    <div role="status" aria-live="polite"
      className={cx('fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium',
        online ? 'bg-emerald-600 text-white' : 'bg-ink-900 text-canvas', className)}>
      {!online && <WifiOff size={15} aria-hidden="true" />}
      {online ? backMessage : message}
    </div>
  )
}
