import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
/**
 * The pages of a document, as a strip you can jump from.
 *
 * PAGE NUMBERS ARE ALWAYS VISIBLE, not on hover. The whole reason to look at
 * thumbnails is to find page 14, and a number that only appears under a pointer
 * is unavailable on touch and to anybody scanning quickly.
 *
 * THE CURRENT PAGE IS MARKED BY WEIGHT AND `aria-current`, not by a coloured
 * border alone — the same rule the rest of the kit follows, and it matters here
 * because a thumbnail strip is mostly a wall of similar grey rectangles.
 *
 * Each thumbnail is a real button naming its page, so the strip is fully
 * operable by keyboard rather than being a row of clickable images.
 */
export function PageThumbnails({ pages, current, onGo, className }: {
  /** One per page, in order. `src` may be absent while rendering. */
  pages: { src?: string | null }[];
  /** 1-based. */
  current?: number;
  onGo: (page: number) => void;
  className?: string;
}) {
  if (!pages.length) return null;
  return (
    <ol className={cn("flex gap-2 overflow-x-auto pb-1", className)}>
      {pages.map((p, i) => {
        const n = i + 1;
        const active = n === current;
        return (
          <li key={n}>
            <button type="button" onClick={() => onGo(n)}
              aria-current={active ? "page" : undefined}
              aria-label={`Go to page ${n} of ${pages.length}`}
              className={cn("flex w-20 cursor-pointer flex-col gap-1 rounded border p-1",
                active ? "border-foreground" : "border-border hover:border-foreground/40")}>
              <SafeImage src={p.src ?? null} alt="" ratio="3/4" className="rounded-xs" />
              <span className={cn("text-center text-xs tabular-nums", active ? "font-medium" : "text-muted-foreground")}>
                {n}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
