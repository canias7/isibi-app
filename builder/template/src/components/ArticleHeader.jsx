import { Link } from 'react-router-dom'
import Avatar from './Avatar.jsx'
import { cx } from '../lib/cx.js'

// ArticleHeader — the top of a post: category, headline, standfirst, byline row, cover image.
// PageHeader is for app pages; this is the editorial one, with the wider measure and the byline.
export default function ArticleHeader({
  category, categoryTo, title, standfirst, author, avatar, authorTo, date, readTime, cover, coverAlt, className,
}) {
  return (
    <header className={cx('py-10', className)}>
      <div className="container-page">
        <div className="mx-auto max-w-3xl">
          {category && (categoryTo
            ? <Link to={categoryTo} className="text-sm font-semibold uppercase tracking-wider text-brand-600 hover:text-brand-700">{category}</Link>
            : <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">{category}</p>)}
          <h1 className="mt-3 text-balance font-display text-4xl font-bold leading-tight tracking-tight text-ink-900 sm:text-5xl">{title}</h1>
          {standfirst && <p className="mt-4 text-lg text-ink-600">{standfirst}</p>}
          {(author || date) && (
            <div className="mt-6 flex items-center gap-3 border-t border-ink-100 pt-6">
              {author && <Avatar name={author} src={avatar} size="sm" />}
              <div className="text-sm">
                {author && (authorTo
                  ? <Link to={authorTo} className="font-medium text-ink-900 hover:text-brand-600">{author}</Link>
                  : <span className="font-medium text-ink-900">{author}</span>)}
                <span className="ml-2 text-ink-400">
                  {date}{readTime && <> · {readTime}</>}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
      {cover && (
        <div className="container-page mt-10">
          <img src={cover} alt={coverAlt || ''} className="w-full rounded-xl2 object-cover" />
        </div>
      )}
    </header>
  )
}
