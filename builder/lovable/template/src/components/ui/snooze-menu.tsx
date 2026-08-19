import * as React from "react";
import { Clock, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, toDate } from "@/lib/utils";
/**
 * "Remind me later" — with times that mean something.
 *
 * THE OPTIONS ARE ABSOLUTE TIMES, computed and shown. "Tomorrow morning" is
 * ambiguous and "in 8 hours" needs arithmetic; "Tomorrow, 9:00" is neither, and
 * it is the only phrasing somebody can sanity-check against their own calendar.
 *
 * OPTIONS IN THE PAST ARE DROPPED. "This evening" offered at 11pm is a
 * reminder that fires immediately, and it is offered by every naive fixed list.
 * The list is derived from the current time, so it changes through the day.
 *
 * THE SNOOZED STATE SAYS WHEN IT COMES BACK and offers to undo. A thing that
 * has vanished with no visible return time is a thing people assume is lost.
 *
 * `Date` arithmetic uses the LOCAL clock deliberately — a reminder is a promise
 * about the reader's own morning, not about UTC.
 */
export function snoozeOptions(now = new Date()) {
  const at = (d: Date, h: number, m = 0) => {
    const x = toDate(d);
    x.setHours(h, m, 0, 0);
    return x;
  };
  const tomorrow = toDate(now); tomorrow.setDate(now.getDate() + 1);
  const monday = toDate(now); monday.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
  const fmt = (d: Date) => d.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });

  return [
    { key: "1h", label: "In an hour", when: new Date(now.getTime() + 3600_000) },
    { key: "evening", label: "This evening", when: at(now, 18) },
    { key: "tomorrow", label: "Tomorrow morning", when: at(tomorrow, 9) },
    { key: "monday", label: "Next week", when: at(monday, 9) },
  ]
    // A "this evening" offered at 11pm fires immediately.
    .filter((o) => o.when.getTime() > now.getTime() + 60_000)
    .map((o) => ({ ...o, at: fmt(o.when) }));
}

export function SnoozeMenu({ snoozedUntil, onSnooze, onUnsnooze, options, className }: {
  snoozedUntil?: React.ReactNode;
  onSnooze: (when: Date) => void;
  onUnsnooze?: () => void;
  options?: { key: string; label: string; when: Date; at: string }[];
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const list = options ?? snoozeOptions();

  if (snoozedUntil) {
    return (
      <p className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <Clock aria-hidden className="size-3" />
        Back {snoozedUntil}.
        {onUnsnooze ? (
          <button type="button" onClick={onUnsnooze}
            className="cursor-pointer underline underline-offset-2 hover:text-foreground">Bring it back now</button>
        ) : null}
      </p>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button"
          className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted", className)}>
          <Clock aria-hidden className="size-3.5" />
          Snooze
          <ChevronDown aria-hidden className="size-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        <ul>
          {list.map((o) => (
            <li key={o.key}>
              <button type="button" onClick={() => { setOpen(false); onSnooze(o.when); }}
                className="flex w-full cursor-pointer items-baseline justify-between gap-3 rounded px-2 py-1.5 text-start text-sm hover:bg-muted">
                {o.label}
                {/* The absolute time, so it can be checked against a calendar. */}
                <span className="text-xs text-muted-foreground tabular-nums">{o.at}</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
