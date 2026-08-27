import { SafeImage } from "@/components/ui/safe-image";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
/**
 * A menu item with a photograph — the café case, where `PriceList` (a text row)
 * is not enough.
 *
 * Dietary tags are written words, never icons. A small leaf that means vegan
 * on one menu and organic on another is worse than useless to somebody with
 * an allergy.
 */
export function DishCard({ name, description, price, image, tags, unavailable, className }: {
  name: string; description?: string; price?: string; image?: string | null;
  tags?: string[]; unavailable?: boolean; className?: string;
}) {
  return (
    <article data-slot="dish-card" className={cn("flex gap-3 rounded-lg border border-border p-3", unavailable && "opacity-60", className)}>
      <SafeImage src={image} alt={name} ratio="1/1" className="size-20 shrink-0 rounded object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-medium">{name}</h3>
          {price && <span className="shrink-0 text-sm tabular-nums">{price}</span>}
        </div>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {unavailable && <Badge variant="outline">Off the menu today</Badge>}
          {tags?.map((t) => <Badge key={t} variant="secondary" className="font-normal">{t}</Badge>)}
        </div>
      </div>
    </article>
  );
}
