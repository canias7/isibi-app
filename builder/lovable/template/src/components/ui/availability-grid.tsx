import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Which times are still free.
 *
 * The hard part of a booking page, and the one thing a booking form cannot do
 * without: a visitor has to see that 14:00 is gone BEFORE submitting, or the
 * first they learn of it is a rejection.
 *
 * `taken` is a plain list of times, so it can come from a public view, an RPC, or
 * anywhere else — this component holds no opinion about where.
 */
export function AvailabilityGrid({
  slots, taken = [], value, onSelect, className,
}: {
  /** All bookable times, e.g. ["09:00","09:30",...]. */
  slots: string[];
  /** The ones already gone. */
  taken?: string[];
  value?: string | null;
  onSelect?: (slot: string) => void;
  className?: string;
}) {
  const gone = new Set(taken);
  return (
    <div className={cn("grid grid-cols-3 gap-2 sm:grid-cols-4", className)} role="group" aria-label="Available times">
      {slots.map((s) => {
        const isGone = gone.has(s);
        return (
          <Button
            key={s}
            type="button"
            size="sm"
            variant={value === s ? "default" : "outline"}
            disabled={isGone}
            aria-label={isGone ? `${s} — already booked` : s}
            onClick={() => onSelect?.(s)}
            className={cn("tabular-nums", isGone && "line-through opacity-50")}
          >
            {s}
          </Button>
        );
      })}
    </div>
  );
}
