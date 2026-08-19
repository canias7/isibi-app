import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
/**
 * A delivery window to choose.
 *
 * A full slot stays visible and disabled rather than disappearing — the same
 * rule as `TimeSlot`. And the price is stated on every slot INCLUDING the
 * free ones, as the word "Free": a blank where the others show a charge reads
 * as a missing price, not a free one.
 */
export function DeliverySlot({ day, window: win, price, currency, full, selected, onSelect, className }: {
  day: string; window: string; price?: number; currency?: string;
  full?: boolean; selected?: boolean; onSelect?: () => void; className?: string;
}) {
  return (
    <button type="button" disabled={full} onClick={onSelect} aria-pressed={selected}
      className={cn("flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-start text-sm",
        full && "cursor-not-allowed border-border opacity-60",
        !full && selected && "border-foreground bg-muted",
        !full && !selected && "border-border hover:bg-muted/50", className)}>
      <span>
        <span className="block font-medium">{day}</span>
        <span className="block text-muted-foreground tabular-nums">{win}</span>
      </span>
      <span className="shrink-0 text-end">
        {full ? <span className="text-xs text-muted-foreground">Full</span>
          : price == null || price === 0 ? <span className="text-xs font-medium">Free</span>
          : <Money amount={price} currency={currency} />}
      </span>
    </button>
  );
}
