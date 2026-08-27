import { cn } from "@/lib/utils";
/** Seven days as buttons. The date picker a booking page actually wants. */
export function WeekStrip({ start, value, onSelect, disabled = [], className }: {
  start: Date; value?: string | null; onSelect?: (iso: string) => void;
  disabled?: string[]; className?: string;
}) {
  const off = new Set(disabled);
  return (
    <div data-slot="week-strip" className={cn("grid grid-cols-7 gap-1", className)} role="group" aria-label="Pick a day">
      {Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        const on = value === key, isOff = off.has(key);
        return (
          <button key={key} type="button" disabled={isOff} onClick={() => onSelect?.(key)}
            aria-pressed={on} aria-label={d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            className={cn("flex cursor-pointer flex-col items-center gap-0.5 rounded-md border py-2 text-xs",
              on && "border-foreground bg-foreground text-background",
              isOff && "cursor-not-allowed text-muted-foreground opacity-50")}>
            <span>{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
            <span className="text-sm font-medium tabular-nums">{d.getDate()}</span>
          </button>
        );
      })}
    </div>
  );
}
