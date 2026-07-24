import { useState } from 'react'
import Lightbox from './Lightbox.tsx'
import { cx } from '../lib/cx.js'
import type { ImageItem } from '../lib/types.ts'

interface GalleryProps {
  images?: ImageItem[]
  columns?: number
  className?: string
}

// Gallery — an image grid wired to the Lightbox. images: [{src, alt}]
export default function Gallery({ images = [], columns = 3, className }: GalleryProps) {
  const [open, setOpen] = useState(false)
  const [i, setI] = useState(0)
  const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' }
  if (!images.length) return null
  return (
    <>
      <div className={cx('grid grid-cols-2 gap-3', cols[columns] || cols[3], className)}>
        {images.map((img, n) => (
          <button key={n} type="button" onClick={() => { setI(n); setOpen(true) }}
            className="group relative aspect-square overflow-hidden rounded-xl bg-ink-100
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            <img src={img.src} alt={img.alt || ''} loading="lazy"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
          </button>
        ))}
      </div>
      <Lightbox open={open} images={images} index={i} onIndexChange={setI} onClose={() => setOpen(false)} />
    </>
  )
}
