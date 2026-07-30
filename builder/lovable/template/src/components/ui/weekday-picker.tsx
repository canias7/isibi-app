import { cn } from "@/lib/utils";
/**
 * Which days something happens on.
 *
 * The order follows the viewer's locale — Sunday first in the US, Monday in
 * most of Europe — derived from `Intl` rather than hardcoded, because a picker
 * whose week starts on the wrong day is misread rather than noticed.
 *
 * Values are 0–6 with 0 = Sunday, matching `Date.getDay()`, so what comes out
 * of this can be compared with a date without a lookup table in between.
 */
function weekOrder(): number[] {
  const loc = new Intl.Locale(typeof navigator !== "undefined" ? navigator.language : "en-GB");
  const info = (loc as unknown as { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } });
  const first = (info.getWeekInfo?.() ?? info.weekInfo)?.firstDay ?? 1;   // ISO: 1 = Monday, 7 = Sunday
  const start = first % 7;                                                // to Date.getDay()
  return Array.from({ length: 7 }, (_, i) => (start + i) % 7);
}
export function WeekdayPicker({ value, onChange, className }: {
  value: number[]; onChange: (days: number[]) => void; className?: string;
}) {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return (
    <div className={cn("flex gap-1", className)} role="group" aria-label="Days">
      {weekOrder().map((d) => {
        const on = value.includes(d);
        return (
          <button key={d} type="button" aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort())}
            className={cn("size-9 cursor-pointer rounded-full border text-xs font-medium",
              on ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")}>
            <span aria-hidden="true">{names[d].slice(0, 2)}</span>
            <span className="sr-only">{names[d]}</span>
          </button>
        );
      })}
    </div>
  );
}
