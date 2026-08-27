import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Which times are still free.
 *
 * The hard part of a booking page: a visitor has to see that 14:00 is gone BEFORE
 * submitting, or the first they learn of it is a rejection.
 *
 * A taken slot is `disabled`, struck through AND labelled "already booked" — the
 * dimming is the least of the three signals, because a disabled control that only
 * looks faint is the classic thing people keep tapping.
 */
export function AvailabilityGrid({ slots, taken = [], value, onSelect, className }: {
  slots: string[]; taken?: string[]; value?: string | null;
  onSelect?: (slot: string) => void; className?: string;
}) {
  const gone = new Set(taken);
  return (
    <div data-slot="availability-grid" className={cn("grid grid-cols-3 gap-2 sm:grid-cols-4", className)} role="group" aria-label="Available times">
      {slots.map((s) => {
        const isGone = gone.has(s);
        return (
          <Button key={s} type="button" size="sm"
            variant={value === s ? "default" : "outline"} disabled={isGone}
            aria-label={isGone ? `${s} — already booked` : s}
            onClick={() => onSelect?.(s)}
            className={cn("tabular-nums", isGone && "line-through opacity-50")}>
            {s}
          </Button>
        );
      })}
    </div>
  );
}
