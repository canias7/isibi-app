import { Link } from 'react-router-dom'
import Avatar from './Avatar.jsx'
import { cx } from '../lib/cx.js'

// ArticleCard — blog post / episode / recipe teaser.
export default function ArticleCard({ title, excerpt, image, alt, to, author, avatar, date, readTime, category, className }) {
  const Wrap = to ? Link : 'div'
  return (
    <article className={cx('group flex flex-col overflow-hidden rounded-xl2 border border-ink-100 bg-surface transition hover:shadow-soft', className)}>
      {image && (
        <Wrap {...(to ? { to } : {})} className="block aspect-[16/9] overflow-hidden bg-ink-100">
          <img src={image} alt={alt || title} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        </Wrap>
      )}
      <div className="flex flex-1 flex-col p-5">
        {category && <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">{category}</span>}
        <Wrap {...(to ? { to } : {})} className="mt-1.5 font-display text-lg font-semibold leading-snug text-ink-900 hover:text-brand-600">{title}</Wrap>
        {excerpt && <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600 line-clamp-3">{excerpt}</p>}
        <div className="mt-4 flex items-center gap-2.5 text-xs text-ink-500">
          {author && <Avatar name={author} src={avatar} size="xs" />}
          {author && <span className="font-medium text-ink-700">{author}</span>}
          {date && <span>· {date}</span>}
          {readTime && <span>· {readTime}</span>}
        </div>
      </div>
    </article>
  )
}
