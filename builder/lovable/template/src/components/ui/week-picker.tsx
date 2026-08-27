import * as React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, toDate } from "@/lib/utils";
/**
 * Pick a week, shown as its date range.
 *
 * ISO 8601 weeks: Monday-first, and week 1 is the one containing the first
 * Thursday. That definition is not a detail — the naive "week containing 1
 * January" disagrees with it several years a decade, which is how a weekly
 * report ends up filed under the wrong number.
 *
 * The dates are always shown alongside the number, because almost nobody
 * knows what week 32 is without them.
 */
function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);                       // to the Thursday of this week
  const jan1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return { year: t.getUTCFullYear(), week: Math.ceil(((+t - +jan1) / 86400000 + 1) / 7) };
}
function mondayOf(year: number, week: number) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = toDate(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (week - 1) * 7);
  return monday;
}
export function WeekPicker({ value, onChange, className }: {
  value?: string | null; onChange: (v: string) => void; className?: string;
}) {
  const parsed = value?.match(/^(\d{4})-W(\d{1,2})$/);
  const current = parsed ? { year: Number(parsed[1]), week: Number(parsed[2]) } : isoWeek(new Date());
  const [year, setYear] = React.useState(current.year);
  const weeks = Array.from({ length: isoWeek(new Date(year, 11, 28)).week }, (_, i) => i + 1);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return (
    <div data-slot="week-picker" className={cn("w-72 space-y-2 rounded-md border border-border p-2", className)}>
      <div className="flex items-center justify-between">
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Previous year" onClick={() => setYear((y) => y - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium tabular-nums" aria-live="polite">{year}</span>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Next year" onClick={() => setYear((y) => y + 1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <ul className="max-h-56 overflow-y-auto">
        {weeks.map((w) => {
          const k = `${year}-W${String(w).padStart(2, "0")}`;
          const mon = mondayOf(year, w);
          const sun = toDate(mon); sun.setUTCDate(mon.getUTCDate() + 6);
          return (
            <li key={w}>
              <button type="button" aria-pressed={k === value} onClick={() => onChange(k)}
                className={cn("flex w-full cursor-pointer items-baseline justify-between gap-3 rounded px-2 py-1.5 text-sm",
                  k === value ? "bg-foreground text-background" : "hover:bg-muted")}>
                <span className="tabular-nums">Week {w}</span>
                <span className={cn("text-xs", k === value ? "opacity-80" : "text-muted-foreground")}>
                  {fmt(mon)} – {fmt(sun)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
