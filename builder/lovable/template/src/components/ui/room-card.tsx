import { SafeImage } from "@/components/ui/safe-image";
import { Button } from "@/components/ui/button";
import { Users, Maximize } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A room — a hotel booking, a venue hire, a studio.
 *
 * The price says what it is per ("per night", "per hour"), inline, rather
 * than in a footnote. A bare number on a room is the single most common way a
 * booking page misleads somebody.
 */
export function RoomCard({ name, description, price, per = "night", sleeps, size, image, amenities, onBook, className }: {
  name: string; description?: string; price?: string; per?: string; sleeps?: number;
  size?: string; image?: string | null; amenities?: string[]; onBook?: () => void; className?: string;
}) {
  return (
    <article className={cn("overflow-hidden rounded-lg border border-border sm:flex", className)}>
      <div className="aspect-[4/3] bg-muted sm:aspect-auto sm:w-48 sm:shrink-0">
        {image && <SafeImage src={image} alt="" className="size-full object-cover" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <h3 className="text-sm font-medium">{name}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {sleeps != null && <li className="flex items-center gap-1.5"><Users className="size-3.5" />Sleeps {sleeps}</li>}
          {size && <li className="flex items-center gap-1.5"><Maximize className="size-3.5" />{size}</li>}
        </ul>
        {amenities?.length ? <p className="text-xs text-muted-foreground">{amenities.join(" · ")}</p> : null}
        <div className="mt-auto flex flex-wrap items-baseline justify-between gap-3 pt-1">
          {price && <p className="text-sm"><span className="font-semibold tabular-nums">{price}</span>
            <span className="text-muted-foreground"> per {per}</span></p>}
          {onBook && <Button size="sm" onClick={onBook}>Book</Button>}
        </div>
      </div>
    </article>
  );
}
