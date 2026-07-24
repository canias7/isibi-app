import { Link } from 'react-router-dom'
import { Clock, PlayCircle, Star } from 'lucide-react'
import Progress from './Progress.tsx'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface CourseCardProps {
  title?: ReactNode
  summary?: any
  image?: string
  alt?: string
  to: string
  instructor?: any
  level?: any
  duration?: any
  lessons?: any
  rating?: any
  ratingCount?: any
  price?: any
  progress?: any
  badge?: any
  className?: string
}

// CourseCard — a course/programme tile. Shows progress when the learner is enrolled and price when they aren't,
// because those are the two different jobs the same card has to do on a catalogue vs a "my learning" page.
export default function CourseCard({
  title, summary, image, alt, to, instructor, level, duration, lessons, rating, ratingCount,
  price, progress, badge, className,
}: CourseCardProps) {
  const enrolled = typeof progress === 'number'
  return (
    <Link to={to} className={cx('card-surface group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500', className)}>
      <div className="relative aspect-[16/9] overflow-hidden bg-ink-100">
        {image && <img src={image} alt={alt || ''} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
        {badge && <span className="absolute left-3 top-3 rounded-full bg-surface/95 px-2.5 py-1 text-xs font-medium text-ink-800">{badge}</span>}
      </div>
      <div className="flex flex-1 flex-col p-5">
        {level && <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{level}</p>}
        <h3 className="mt-1 font-display text-base font-semibold text-ink-900">{title}</h3>
        {summary && <p className="mt-1.5 line-clamp-2 text-sm text-ink-600">{summary}</p>}
        {instructor && <p className="mt-3 text-sm text-ink-500">{instructor}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
          {duration && <span className="inline-flex items-center gap-1"><Clock size={12} />{duration}</span>}
          {lessons && <span className="inline-flex items-center gap-1"><PlayCircle size={12} />{lessons} lessons</span>}
          {rating && (
            <span className="inline-flex items-center gap-1 text-ink-600">
              <Star size={12} className="fill-accent-400 text-accent-400" />
              <span className="font-medium tabular-nums">{rating}</span>
              {ratingCount && <span className="text-ink-400">({ratingCount})</span>}
            </span>
          )}
        </div>
        <div className="mt-4 flex items-end justify-between gap-3 pt-1">
          {enrolled
            ? <Progress value={progress} label={`${progress}% complete`} size="sm" className="flex-1" />
            : price && <span className="font-display text-lg font-semibold text-ink-900">{price}</span>}
        </div>
      </div>
    </Link>
  )
}
