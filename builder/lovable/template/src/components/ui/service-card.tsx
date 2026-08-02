import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A bookable service — a haircut, a treatment, a lesson.
 *
 * Duration sits beside the price because it is half the price: an hour at £40
 * and twenty minutes at £40 are different offers, and a list showing only the
 * money makes them look identical.
 */
export function ServiceCard({ name, description, price, duration, image, onBook, bookLabel = "Book", className }: {
  name: string; description?: string; price?: string; duration?: string;
  image?: string | null; onBook?: () => void; bookLabel?: string; className?: string;
}) {
  return (
    <article className={cn("flex items-start gap-3 rounded-lg border border-border p-3", className)}>
      <SafeImage src={image} alt={name} ratio="1/1" className="size-16 shrink-0 rounded object-cover" />
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-medium">{name}</h3>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        <p className="mt-1 flex items-center gap-3 text-sm">
          {price && <span className="font-medium tabular-nums">{price}</span>}
          {duration && <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="size-3.5" />{duration}</span>}
        </p>
      </div>
      {onBook && <Button size="sm" onClick={onBook}>{bookLabel}</Button>}
    </article>
  );
}
