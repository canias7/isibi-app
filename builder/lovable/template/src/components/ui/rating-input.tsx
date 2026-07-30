import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Give a rating.
 *
 * Real radio inputs behind the stars, so it is keyboard operable and submits with
 * the form — the usual span-with-onClick version is neither.
 */
export function RatingInput({ name = "rating", value, onChange, max = 5, className }: {
  name?: string; value?: number; onChange: (n: number) => void; max?: number; className?: string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  return (
    <fieldset className={cn("flex items-center gap-0.5", className)} onMouseLeave={() => setHover(null)}>
      <legend className="sr-only">Rating out of {max}</legend>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <label key={n} className="cursor-pointer p-0.5" onMouseEnter={() => setHover(n)}>
          <input type="radio" name={name} value={n} checked={value === n}
            onChange={() => onChange(n)} className="sr-only" />
          <Star className={cn("size-6", n <= shown ? "fill-foreground text-foreground" : "text-muted-foreground/40")} />
          <span className="sr-only">{n} {n === 1 ? "star" : "stars"}</span>
        </label>
      ))}
    </fieldset>
  );
}
