import { Star } from "lucide-react";
import { cn, divide } from "@/lib/utils";

/** A rating out of five. Announced to screen readers as a sentence, not as icons. */
export function ReviewStars({ value, count, max = 5, className }: {
  value: number;
  /** "(42 reviews)" */
  count?: number;
  max?: number;
  className?: string;
}) {
  const v = Math.max(0, Math.min(max, value));
  return (
    <div className={cn("flex items-center gap-2", className)}
      role="img" aria-label={`${v} out of ${max}${count != null ? `, ${count} reviews` : ""}`}>
      {/* Partial fill by CLIPPING a filled row over an empty one.
          It used to round: `i < Math.round(v)`, so 4.5 drew five solid stars —
          a four-and-a-half-star business advertised as a five-star one, and
          every real aggregate rating is a fraction. */}
      <span className="relative flex" aria-hidden="true">
        {Array.from({ length: max }, (_, i) => (
          <Star key={i} className="size-4 text-muted-foreground/40" />
        ))}
        <span className="absolute inset-y-0 start-0 flex overflow-hidden"
          style={{ width: `${divide(v, max) * 100}%` }}>
          {Array.from({ length: max }, (_, i) => (
            <Star key={i} className="size-4 shrink-0 fill-foreground text-foreground" />
          ))}
        </span>
      </span>
      <span className="text-sm tabular-nums text-muted-foreground">
        {v.toFixed(1)}{count != null ? ` (${count})` : ""}
      </span>
    </div>
  );
}
