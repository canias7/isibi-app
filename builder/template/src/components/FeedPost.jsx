import { Link } from 'react-router-dom'
import { MessageSquare, MoreHorizontal, Repeat2, Share2 } from 'lucide-react'
import Avatar from './Avatar.jsx'
import ReactionBar from './ReactionBar.jsx'
import Gallery from './Gallery.jsx'
import { cx } from '../lib/cx.js'

// FeedPost — one post in a timeline: author, body, media, reactions, action row. Comment is a threaded reply;
// this is the top-level post that owns the media and the share/repost actions.
export default function FeedPost({
  author, handle, avatar, authorTo, time, body, media = [], reactions = [], onReact,
  comments, shares, reposts, onComment, onShare, onRepost, menu, pinned, className,
}) {
  return (
    <article className={cx('card-surface p-5', className)}>
      {pinned && <p className="mb-2 text-xs font-medium text-ink-400">Pinned</p>}
      <header className="flex items-start gap-3">
        <Avatar name={author} src={avatar} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            {authorTo
              ? <Link to={authorTo} className="text-sm font-semibold text-ink-900 hover:text-brand-600">{author}</Link>
              : <span className="text-sm font-semibold text-ink-900">{author}</span>}
            {handle && <span className="text-xs text-ink-400">@{handle}</span>}
            {time && <span className="text-xs text-ink-400">· {time}</span>}
          </div>
        </div>
        {menu && (
          <div className="shrink-0">{typeof menu === 'function' ? menu() : menu}</div>
        )}
        {!menu && (
          <button type="button" aria-label="Post options"
            className="shrink-0 rounded-lg p-1 text-ink-300 transition hover:bg-ink-100 hover:text-ink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            <MoreHorizontal size={16} />
          </button>
        )}
      </header>
      {body && <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-800">{body}</div>}
      {media.length > 0 && (
        <div className="mt-3">
          {/* One image goes full-bleed; several go through the Gallery so the lightbox comes for free. */}
          {media.length === 1
            ? <img src={media[0].src} alt={media[0].alt || ''} className="w-full rounded-xl2 object-cover" />
            : <Gallery images={media} columns={media.length === 2 ? 2 : 3} />}
        </div>
      )}
      {reactions.length > 0 && <ReactionBar className="mt-3" reactions={reactions} onToggle={onReact} onAdd={onReact} />}
      <footer className="mt-3 flex items-center gap-1 border-t border-ink-100 pt-2 text-ink-500">
        {[
          onComment && { icon: MessageSquare, label: 'Comment', count: comments, onClick: onComment },
          onRepost && { icon: Repeat2, label: 'Repost', count: reposts, onClick: onRepost },
          onShare && { icon: Share2, label: 'Share', count: shares, onClick: onShare },
        ].filter(Boolean).map((a, i) => {
          const Icon = a.icon
          return (
            <button key={i} type="button" onClick={a.onClick}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm transition hover:bg-ink-100 hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              <Icon size={15} />
              <span>{a.label}</span>
              {a.count > 0 && <span className="tabular-nums text-ink-400">{a.count}</span>}
            </button>
          )
        })}
      </footer>
    </article>
  )
}
