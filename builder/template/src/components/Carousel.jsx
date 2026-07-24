import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cx } from '../lib/cx.js'

// Carousel — image/content slider (galleries, product shots, testimonials).
export default function Carousel({ slides = [], aspect = 'aspect-[16/9]', className }) {
  const [i, setI] = useState(0)
  if (!slides.length) return null
  const go = (n) => setI((n + slides.length) % slides.length)
  return (
    <div className={cx('relative overflow-hidden rounded-xl2 bg-ink-100', className)}>
      <div className={cx('w-full', aspect)}>
        {slides.map((s, n) => (
          <div key={n} className={cx('absolute inset-0 transition-opacity duration-500', n === i ? 'opacity-100' : 'pointer-events-none opacity-0')}>
            {s}
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <>
          <button type="button" aria-label="Previous" onClick={() => go(i - 1)}
            className="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink-700 shadow transition hover:bg-white">
            <ChevronLeft size={18} />
          </button>
          <button type="button" aria-label="Next" onClick={() => go(i + 1)}
            className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink-700 shadow transition hover:bg-white">
            <ChevronRight size={18} />
          </button>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {slides.map((_, n) => (
              <button key={n} type="button" aria-label={`Go to slide ${n + 1}`} onClick={() => setI(n)}
                className={cx('h-1.5 rounded-full transition-all', n === i ? 'w-5 bg-white' : 'w-1.5 bg-white/60')} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
