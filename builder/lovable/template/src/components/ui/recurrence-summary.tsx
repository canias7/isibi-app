import { cn, toDate } from "@/lib/utils";
/**
 * Says a repeating rule in words — "every 2 weeks on Tuesday and Thursday,
 * until 14 August".
 *
 * `RecurringPicker` builds the rule; this reads it back. That readback is the
 * only way somebody checks they set what they meant, and a form that shows
 * only its own controls ("Weekly", "2", two ticked boxes) leaves the meaning
 * to be assembled in the reader's head.
 *
 * Day names come from `Intl`, so the sentence is in the reader's language and
 * the week starts where they expect. Days are 0-6 with 0 = Sunday, matching
 * `Date.getDay()`.
 */
export function RecurrenceSummary({ freq, interval = 1, days, until, count, className }: {
  freq: "day" | "week" | "month" | "year"; interval?: number;
  days?: number[]; until?: string | number | Date | null; count?: number | null;
  className?: string;
}) {
  const dayName = (n: number) => new Date(2024, 0, 7 + n).toLocaleDateString(undefined, { weekday: "long" });
  const list = (xs: string[]) => {
    try { return new Intl.ListFormat(undefined, { style: "long", type: "conjunction" }).format(xs); }
    catch { return xs.join(", "); }
  };
  const every = interval === 1
    ? { day: "Every day", week: "Every week", month: "Every month", year: "Every year" }[freq]
    : `Every ${interval} ${freq}s`;
  const on = freq === "week" && days?.length
    ? ` on ${list([...days].sort((a, b) => a - b).map(dayName))}` : "";
  const end = until && !Number.isNaN(toDate(until).getTime())
    ? `, until ${toDate(until).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}`
    : count != null && count > 0 ? `, ${count} times` : "";
  return <p data-slot="recurrence-summary" className={cn("text-sm text-muted-foreground", className)}>{every}{on}{end}</p>;
}
