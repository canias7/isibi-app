import * as React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Pick a year, twelve at a time.
 *
 * A grid rather than a dropdown of ninety options, and paged rather than
 * scrolled: a select with a hundred years in it is the control people abandon
 * on a date-of-birth form, which is why `date-of-birth` uses a plain text box
 * instead. This is for the other case — a report year, a founding year —
 * where the range is short and browsing it is the point.
 */
export function YearPicker({ value, onChange, min, max, className }: {
  value?: number | null; onChange: (y: number) => void;
  min?: number; max?: number; className?: string;
}) {
  const now = new Date().getFullYear();
  const [page, setPage] = React.useState(() => Math.floor(((value ?? now) - 4) / 12) * 12 + 4);
  const years = Array.from({ length: 12 }, (_, i) => page + i);
  const blocked = (y: number) => (min != null && y < min) || (max != null && y > max);
  return (
    <div className={cn("w-64 space-y-2 rounded-md border border-border p-2", className)}>
      <div className="flex items-center justify-between">
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Earlier years" onClick={() => setPage((p) => p - 12)}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium tabular-nums" aria-live="polite">{years[0]}–{years[11]}</span>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Later years" onClick={() => setPage((p) => p + 12)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {years.map((y) => (
          <button key={y} type="button" disabled={blocked(y)} aria-pressed={y === value} onClick={() => onChange(y)}
            className={cn("cursor-pointer rounded px-2 py-2 text-sm tabular-nums",
              blocked(y) && "cursor-not-allowed text-muted-foreground opacity-50",
              y === value && "bg-foreground text-background",
              y !== value && !blocked(y) && "hover:bg-muted")}>
            {y}
          </button>
        ))}
      </div>
    </div>
  );
}
