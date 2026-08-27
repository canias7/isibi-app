import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
/** Pictures in a grid, with captions. `gallery` is the version that opens them. */
export function MediaGrid({ items, columns = 3, ratio = "1/1", className }: {
  items: { src?: string | null; alt?: string; caption?: string | null }[];
  columns?: 2 | 3 | 4; ratio?: string; className?: string;
}) {
  const c = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" }[columns];
  return (
    <div data-slot="media-grid" className={cn("grid gap-3", c, className)}>
      {items.map((m, i) => (
        <figure key={i} className="flex flex-col gap-1.5">
          <SafeImage src={m.src} alt={m.alt} ratio={ratio} />
          {m.caption && <figcaption className="text-xs text-muted-foreground">{m.caption}</figcaption>}
        </figure>
      ))}
    </div>
  );
}
