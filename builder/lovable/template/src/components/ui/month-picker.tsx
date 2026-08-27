import * as React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Pick a month — a twelve-cell grid, not a day calendar.
 *
 * A day calendar for "which month" makes somebody choose an arbitrary day
 * they did not mean, and the 1st versus the 31st then decides which side of a
 * boundary the answer falls on. This returns `YYYY-MM` and nothing else.
 *
 * Month names come from `Intl`, so the grid is in the reader's own language.
 */
export function MonthPicker({ value, onChange, min, max, className }: {
  value?: string | null; onChange: (v: string) => void;
  min?: string; max?: string; className?: string;
}) {
  const now = new Date();
  const [year, setYear] = React.useState(() => Number(value?.slice(0, 4)) || now.getFullYear());
  const months = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleString(undefined, { month: "short" }));
  const key = (m: number) => `${year}-${String(m + 1).padStart(2, "0")}`;
  const blocked = (k: string) => (min && k < min) || (max && k > max);
  return (
    <div data-slot="month-picker" className={cn("w-64 space-y-2 rounded-md border border-border p-2", className)}>
      <div className="flex items-center justify-between">
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Previous year" onClick={() => setYear((y) => y - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium tabular-nums" aria-live="polite">{year}</span>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Next year" onClick={() => setYear((y) => y + 1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {months.map((m, i) => {
          const k = key(i);
          return (
            <button key={m} type="button" disabled={!!blocked(k)} aria-pressed={k === value}
              onClick={() => onChange(k)}
              className={cn("cursor-pointer rounded px-2 py-2 text-sm",
                blocked(k) && "cursor-not-allowed text-muted-foreground opacity-50",
                k === value && "bg-foreground text-background",
                k !== value && !blocked(k) && "hover:bg-muted")}>
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}
