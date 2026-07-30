import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

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
      <span className="flex" aria-hidden="true">
        {Array.from({ length: max }, (_, i) => (
          <Star key={i} className={cn("size-4", i < Math.round(v) ? "fill-foreground text-foreground" : "text-muted-foreground/40")} />
        ))}
      </span>
      <span className="text-sm tabular-nums text-muted-foreground">
        {v.toFixed(1)}{count != null ? ` (${count})` : ""}
      </span>
    </div>
  );
}
