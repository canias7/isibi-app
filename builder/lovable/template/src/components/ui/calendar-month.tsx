import { cn } from "@/lib/utils";
/**
 * A month grid with things ON the days.
 *
 * shadcn's `calendar` picks a date; this one DISPLAYS a schedule, which is a
 * different job — an owner looking at their week does not want a date picker.
 * Weeks start Monday, which is what most of the world uses.
 */
export function CalendarMonth({ month, events = {}, onSelect, selected, className }: {
  /** Any date inside the month to show. */
  month: Date;
  /** Keyed "YYYY-MM-DD" → how many things happen that day. */
  events?: Record<string, number>;
  onSelect?: (iso: string) => void; selected?: string | null; className?: string;
}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const iso = (d: number) =>
    `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return (
    <div data-slot="calendar-month" className={className}>
      <div className="mb-2 text-sm font-medium">
        {first.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => <div key={"p" + i} />)}
        {Array.from({ length: days }, (_, i) => {
          const d = i + 1, key = iso(d), n = events[key] ?? 0;
          const on = selected === key;
          return (
            <button key={key} type="button" onClick={() => onSelect?.(key)}
              aria-label={`${d}${n ? `, ${n} booked` : ""}`} aria-pressed={on}
              className={cn("flex aspect-square cursor-pointer flex-col items-center justify-center rounded-md border text-sm tabular-nums",
                on ? "border-foreground bg-foreground text-background" : "border-transparent hover:bg-muted")}>
              {d}
              {n > 0 && <span className={cn("mt-0.5 size-1 rounded-full", on ? "bg-background" : "bg-foreground")} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
