import { cx } from '../lib/cx.js'

// VideoEmbed — a lesson/promo video. Pass `src` for a direct file, or `embed` for a YouTube/Vimeo URL.
export default function VideoEmbed({ src, embed, poster, title = 'Video', className }) {
  return (
    <div className={cx('relative overflow-hidden rounded-xl2 bg-ink-900 aspect-[16/9]', className)}>
      {embed ? (
        <iframe src={embed} title={title} allowFullScreen loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
          className="absolute inset-0 h-full w-full border-0" />
      ) : (
        <video src={src} poster={poster} controls preload="metadata" className="absolute inset-0 h-full w-full object-cover">
          Your browser does not support video playback.
        </video>
      )}
    </div>
  )
}
