import * as React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Q1–Q4 of a year.
 *
 * Each quarter shows ITS MONTHS underneath, because "Q3" means July–September
 * to some businesses and October–December to others, and a picker that only
 * says "Q3" is read wrongly by whoever is on a different financial year.
 *
 * `startMonth` shifts the whole thing for a company whose year does not begin
 * in January — a real difference, not a preference, and the reason a
 * hardcoded calendar-quarter picker is wrong for a good share of businesses.
 */
export function QuarterPicker({ value, onChange, startMonth = 1, className }: {
  value?: string | null; onChange: (v: string) => void;
  startMonth?: number; className?: string;
}) {
  const now = new Date();
  const [year, setYear] = React.useState(() => Number(value?.slice(0, 4)) || now.getFullYear());
  const name = (m: number) => new Date(2000, ((m - 1) % 12 + 12) % 12, 1).toLocaleString(undefined, { month: "short" });
  return (
    <div data-slot="quarter-picker" className={cn("w-64 space-y-2 rounded-md border border-border p-2", className)}>
      <div className="flex items-center justify-between">
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Previous year" onClick={() => setYear((y) => y - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium tabular-nums" aria-live="polite">{year}</span>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Next year" onClick={() => setYear((y) => y + 1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {[0, 1, 2, 3].map((q) => {
          const k = `${year}-Q${q + 1}`;
          const first = startMonth + q * 3;
          return (
            <button key={q} type="button" aria-pressed={k === value} onClick={() => onChange(k)}
              className={cn("cursor-pointer rounded px-2 py-2 text-sm",
                k === value ? "bg-foreground text-background" : "hover:bg-muted")}>
              <span className="block font-medium">Q{q + 1}</span>
              <span className={cn("block text-[10px]", k === value ? "opacity-80" : "text-muted-foreground")}>
                {name(first)}–{name(first + 2)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
