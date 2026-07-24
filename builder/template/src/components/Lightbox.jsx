import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

// Lightbox — full-screen image viewer for galleries. images: [{src, alt}], index + onIndexChange.
export default function Lightbox({ open, images = [], index = 0, onIndexChange, onClose }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose && onClose()
      if (e.key === 'ArrowRight' && onIndexChange) onIndexChange((index + 1) % images.length)
      if (e.key === 'ArrowLeft' && onIndexChange) onIndexChange((index - 1 + images.length) % images.length)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, index, images.length, onIndexChange, onClose])
  if (!open || !images.length) return null
  const img = images[index] || images[0]
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/90 p-6" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute right-5 top-5 text-white/70 transition hover:text-white"><X size={24} /></button>
      {images.length > 1 && (
        <button type="button" aria-label="Previous" onClick={() => onIndexChange && onIndexChange((index - 1 + images.length) % images.length)}
          className="absolute left-5 text-white/70 transition hover:text-white"><ChevronLeft size={30} /></button>
      )}
      <img src={img.src} alt={img.alt || ''} className="max-h-[85vh] max-w-full rounded-xl object-contain" />
      {images.length > 1 && (
        <button type="button" aria-label="Next" onClick={() => onIndexChange && onIndexChange((index + 1) % images.length)}
          className="absolute right-5 text-white/70 transition hover:text-white"><ChevronRight size={30} /></button>
      )}
    </div>,
    document.body
  )
}
