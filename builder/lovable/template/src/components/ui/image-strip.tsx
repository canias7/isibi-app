import { SafeImage } from "@/components/ui/safe-image";
import { OverflowScroller } from "@/components/ui/overflow-scroller";
import { cn } from "@/lib/utils";
/**
 * A row of pictures that scrolls sideways.
 *
 * Scroll snapping rather than a carousel: no JS, no autoplay, and a swipe on a
 * phone works because it is the browser's own scrolling.
 */
export function ImageStrip({ items, size = 200, className }: {
  items: { src?: string | null; alt?: string }[]; size?: number; className?: string;
}) {
  return (
    <OverflowScroller className={cn("snap-x snap-mandatory", className)}>
      <div className="flex gap-3 pb-1">
        {items.map((m, i) => (
          <div key={i} className="shrink-0 snap-start" style={{ width: size }}>
            <SafeImage src={m.src} alt={m.alt} ratio="1/1" />
          </div>
        ))}
      </div>
    </OverflowScroller>
  );
}
