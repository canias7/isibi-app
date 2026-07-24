import { cx } from '../lib/cx.js'

// Marquee — an endlessly scrolling strip of logos, testimonials or tags. The track is duplicated and shifted
// by exactly -50%, so the loop is seamless with no JS and no measurement.
// Motion is suppressed under prefers-reduced-motion, where it falls back to a plain scrollable row.
export default function Marquee({ children, items, speed = 32, reverse = false, fade = true, gap = '3rem', className }) {
  const content = items ? items.map((it, i) => <span key={i} className="shrink-0">{it}</span>) : children
  const track = (
    <div className="flex shrink-0 items-center motion-safe:animate-[isibi-marquee_var(--marq-dur)_linear_infinite]"
      style={{ gap, paddingRight: gap, animationDirection: reverse ? 'reverse' : 'normal' }} aria-hidden={undefined}>
      {content}
    </div>
  )
  return (
    <div className={cx('group relative overflow-hidden', fade &&
      '[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]', className)}
      style={{ '--marq-dur': `${speed}s` }}>
      <style>{'@keyframes isibi-marquee{from{transform:translateX(0)}to{transform:translateX(-100%)}}'}</style>
      <div className="flex w-max motion-safe:group-hover:[animation-play-state:paused] motion-reduce:overflow-x-auto">
        {track}
        {/* The duplicate carries aria-hidden so screen readers announce the list once. */}
        <div className="flex shrink-0 items-center motion-safe:animate-[isibi-marquee_var(--marq-dur)_linear_infinite]"
          style={{ gap, paddingRight: gap, animationDirection: reverse ? 'reverse' : 'normal' }} aria-hidden="true">
          {content}
        </div>
      </div>
    </div>
  )
}
