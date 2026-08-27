import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar } from "lucide-react";
import { cn, toDate } from "@/lib/utils";
/**
 * One event.
 *
 * The date block is rendered as day-over-month rather than a formatted
 * sentence: a list of events is scanned down its left edge, and a column of
 * "Thursday 14 August 2026" cannot be scanned at all.
 */
export function EventCard({ title, start, venue, image, price, soldOut, href, onBook, className }: {
  title: string; start: string | number | Date; venue?: string; image?: string | null;
  price?: string; soldOut?: boolean; href?: string; onBook?: () => void; className?: string;
}) {
  const d = toDate(start);
  const valid = !Number.isNaN(d.getTime());
  return (
    <article data-slot="event-card" className={cn("flex gap-4 rounded-lg border border-border p-3", className)}>
      {image
        ? <SafeImage src={image} alt="" className="size-24 shrink-0 rounded object-cover" />
        : valid && (
            <div className="flex size-24 shrink-0 flex-col items-center justify-center rounded bg-muted">
              <span className="text-2xl font-semibold tabular-nums leading-none">{d.getDate()}</span>
              <span className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                {d.toLocaleString(undefined, { month: "short" })}
              </span>
            </div>
          )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium">{href ? <a href={href} className="hover:underline">{title}</a> : title}</h3>
          {soldOut && <Badge variant="outline">Sold out</Badge>}
        </div>
        <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
          {valid && <p className="flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            {d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
          </p>}
          {venue && <p className="flex items-center gap-1.5"><MapPin className="size-3.5" />{venue}</p>}
        </div>
        <div className="mt-2 flex items-center gap-3">
          {price && <span className="text-sm font-medium">{price}</span>}
          {onBook && <Button size="sm" disabled={soldOut} onClick={onBook}>{soldOut ? "Sold out" : "Book"}</Button>}
        </div>
      </div>
    </article>
  );
}
