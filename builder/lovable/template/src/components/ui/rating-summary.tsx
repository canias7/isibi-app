import { ReviewStars } from "@/components/ui/review-stars";
import { cn } from "@/lib/utils";
/**
 * The average plus the distribution.
 *
 * The bars are what make an average honest — 4.2 from a hundred fours is a very
 * different business from 4.2 from fifties and ones.
 */
export function RatingSummary({ average, total, distribution, className }: {
  average: number; total: number;
  /** Count per star, index 0 = one star. */
  distribution: number[]; className?: string;
}) {
  const max = Math.max(1, ...distribution);
  return (
    <div data-slot="rating-summary" className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-8", className)}>
      <div className="flex flex-col gap-1">
        <span className="text-4xl font-semibold tabular-nums">{average.toFixed(1)}</span>
        <ReviewStars value={average} />
        <span className="text-sm text-muted-foreground tabular-nums">{total} reviews</span>
      </div>
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        {[5, 4, 3, 2, 1].map((star) => {
          const n = distribution[star - 1] ?? 0;
          return (
            <div key={star} className="flex items-center gap-2 text-xs">
              <span className="w-3 tabular-nums text-muted-foreground">{star}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <span className="block h-full bg-foreground" style={{ width: (n / max) * 100 + "%" }} />
              </span>
              <span className="w-8 text-end tabular-nums text-muted-foreground">{n}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
