import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
/**
 * When you are open, one row per day.
 *
 * CLOSED IS A SWITCH, NOT AN EMPTY PAIR OF TIMES. Leaving the boxes blank to
 * mean closed is ambiguous with "not filled in yet", and the two want opposite
 * treatment on a published site: one prints "Closed", the other should print
 * nothing at all.
 *
 * A closed day KEEPS its times, greyed. Somebody who closes Monday for the
 * winter and reopens in March should not have to remember what the hours were,
 * and clearing them on toggle is the most annoying possible way to be tidy.
 *
 * Times are a native `<select>` of half-hours rather than a time picker. It
 * covers what a business actually opens at, it is one tap on a phone, and it
 * removes the entire class of "9" versus "09:00" versus "9am" parsing.
 *
 * Day names come from `Intl.DateTimeFormat` so they arrive in the reader's
 * language, and the ORDER is the caller's — the week does not start on Monday
 * everywhere.
 */
const SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2), m = i % 2 ? "30" : "00";
  return `${String(h).padStart(2, "0")}:${m}`;
});

export type DayHours = { key: string; open: boolean; from: string; to: string };

export function WorkingHoursInput({ days, onChange, className }: {
  /** One per day, in the order they should show. */
  days: DayHours[];
  onChange: (key: string, next: Partial<DayHours>) => void;
  className?: string;
}) {
  if (!days.length) return null;
  const name = (key: string) => {
    const d = new Date(`2024-01-0${(["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(key) + 7) || 7}`);
    return Number.isNaN(d.getTime())
      ? key
      : new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(d);
  };

  return (
    <ul className={cn("divide-y divide-border rounded-md border border-border", className)}>
      {days.map((d) => (
        <li key={d.key} className="flex flex-wrap items-center gap-3 p-3">
          <span className="w-24 shrink-0 text-sm font-medium capitalize">{name(d.key)}</span>
          <Switch checked={d.open} onCheckedChange={(v) => onChange(d.key, { open: v })}
            aria-label={`${name(d.key)} open`} />
          <span className={cn("flex items-center gap-2", !d.open && "opacity-40")}>
            <NativeSelect value={d.from} disabled={!d.open} className="h-8 w-24 text-sm"
              aria-label={`${name(d.key)} opens`}
              onChange={(e) => onChange(d.key, { from: e.target.value })}>
              {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </NativeSelect>
            <span className="text-sm text-muted-foreground">to</span>
            <NativeSelect value={d.to} disabled={!d.open} className="h-8 w-24 text-sm"
              aria-label={`${name(d.key)} closes`}
              onChange={(e) => onChange(d.key, { to: e.target.value })}>
              {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </NativeSelect>
          </span>
          {!d.open && <span className="text-sm text-muted-foreground">Closed</span>}
        </li>
      ))}
    </ul>
  );
}
