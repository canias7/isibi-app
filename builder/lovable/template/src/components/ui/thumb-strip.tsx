import * as React from "react";
import { cn, scrollBehavior } from "@/lib/utils";
/**
 * The row of thumbnails under a main image.
 *
 * The selected thumbnail is SCROLLED INTO VIEW when it changes, with `nearest`
 * and `inline`. Arrowing to image nine on a strip that only shows five means
 * the selection has moved somewhere off screen, and the strip stops telling
 * anybody where they are.
 *
 * A real tablist — `role="tablist"`, one tab stop, arrow keys, `aria-selected`
 * — because that is exactly what this is: a set of controls choosing which
 * single thing is shown. A row of buttons each in the tab order makes tabbing
 * past a twenty-image gallery a twenty-press job.
 *
 * The selected one is marked by an opaque BORDER and by dimming the others, not
 * by a coloured outline alone — a thin ring against a photograph is invisible
 * on about half of them.
 *
 * `scroll-snap` and momentum scrolling, so a swipe works because it is the
 * browser's own scrolling. Same reasoning as `image-strip`; no carousel
 * library, no autoplay, no dots.
 */
export function ThumbStrip({ images, index, onSelect, className }: {
  images: { src: string; alt?: string }[];
  index: number;
  onSelect: (index: number) => void;
  className?: string;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  React.useEffect(() => {
    refs.current[index]?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: scrollBehavior() });
  }, [index]);

  return (
    <div role="tablist" aria-label="Choose an image"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); onSelect((index + 1) % images.length); }
        if (e.key === "ArrowLeft") { e.preventDefault(); onSelect((index - 1 + images.length) % images.length); }
        if (e.key === "Home") { e.preventDefault(); onSelect(0); }
        if (e.key === "End") { e.preventDefault(); onSelect(images.length - 1); }
      }}
      className={cn("flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]", className)}>
      {images.map((img, i) => (
        <button
          key={img.src + i}
          ref={(el) => { refs.current[i] = el; }}
          role="tab"
          type="button"
          aria-selected={i === index}
          aria-label={img.alt || `Image ${i + 1}`}
          tabIndex={i === index ? 0 : -1}
          onClick={() => onSelect(i)}
          className={cn("shrink-0 snap-start cursor-pointer overflow-hidden rounded-md border-2 transition-opacity",
            i === index ? "border-foreground" : "border-transparent opacity-60 hover:opacity-100")}
        >
          <img src={img.src} alt="" className="block size-16 object-cover" />
        </button>
      ))}
    </div>
  );
}
